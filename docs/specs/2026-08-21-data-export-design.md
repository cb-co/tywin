# Data export (BUILD-07)

**Date:** 21 Aug 2026
**Audit item:** BUILD-07 · High — *"Export, because you already promise it twice"*
**Audit doc:** `docs/product-audit-dominican-market.md`

## Why

Three places in shipped copy tell the user they can export their data:

| Where | Key | Copy |
| --- | --- | --- |
| Marketing home, CTA | `messages/en.json:36` | "Your data stays yours, exportable or deletable any time from Settings." |
| Terms §6 | `messages/{en,es}.json:800` | "You can export or permanently delete your account and its data at any time from Settings." |
| Privacy §6 | `messages/{en,es}.json:822` | "If you'd like help exporting or removing your data, contact us…" |

`grep -ri csv` over `app/`, `lib/`, `components/` and `messages/` returns nothing but ES module
keywords. There is no export anywhere in the codebase.

The delete half of that promise *is* built — `deleteAccount` in `app/(app)/settings/actions.ts:31`
calls the `delete_own_account()` RPC. So the sentence is half true in the direction that costs the
user everything: they can destroy their data from Settings but not copy it first. This item closes
the gap, and it is the last unshipped build item in the audit's Now horizon (§07).

It is worth being honest that this does not move the north-star metric (statements imported in the
last 35 days). It retires a liability rather than earning a retained user. That is why it is one day
of work and not more.

## Scope

In:

1. `GET /api/export/transactions` — the ledger as CSV.
2. `GET /api/export/data` — everything the app holds, as JSON.
3. A manifest of user-owned tables, with a drift test against the generated schema.
4. Whole-table paging, so no export can silently truncate.
5. A rate limit on both routes.
6. Two rows in Settings, copy at en/es parity, help guide updated.
7. Privacy §6 pointed at Settings instead of at "contact us".

Out, with reasons in §10: any importer, zip packaging, filtered export from the ledger, email or
async delivery, PDF statement copies.

## 1 · Two routes, two files, no zip

Settings gets two independent actions rather than one bundled artifact:

```
app/api/export/transactions/route.ts   → text/csv
app/api/export/data/route.ts           → application/json
```

A zip would need a stream writer (a new dependency), would have to buffer, and would put the file
95% of people actually want — a spreadsheet of their transactions — behind an unzip step on a phone,
where unzipping is genuinely awkward. Two routes cost less and ask less of the user.

Auth follows `app/api/ask/route.ts` exactly: `supabase.auth.getUser()`, `401` when absent, then
every read is scoped by RLS with no `.eq("user_id", …)` anywhere — the convention that file's own
comment calls out ("No `.eq("id", ...)` — RLS scopes the row").

Both stay on the default Node runtime. Streaming a `ReadableStream` needs nothing special there,
and `runtime = "edge"` would cost Node APIs for no gain — noted because reaching for edge to stream
is a common reflex and the wrong one here.

Both responses send `Cache-Control: no-store`. This is a complete personal financial history; it
must never sit in a CDN, a proxy, or a shared browser's cache.

New module:

```
lib/export/manifest.ts     which tables are the user's, and which are not
lib/export/paginate.ts     read a whole table in pages (§3)
lib/export/csv.ts          rows → CSV, pure and testable (§4)
lib/export/serialize.ts    the JSON envelope (§5)
lib/export/rate-limit.ts   the per-user cap (§6)
```

## 2 · The manifest, and the failure it exists to prevent

`lib/supabase/types.ts` reports 17 tables in `public`. Fifteen carry a `user_id` column; `profiles`
is keyed by `id` = `auth.uid()`; `currencies` is reference data. So sixteen tables are exported and
one is not:

| Exported (16) |
| --- |
| `profiles`, `accounts`, `banks`, `card_groups`, `card_statements`, `card_statement_lines`, `categories`, `category_budgets`, `category_rules`, `daily_recommendations`, `goal_contributions`, `savings_goals`, `statement_imports`, `statement_section_mappings`, `subscriptions`, `transactions` |

| Not exported | Why |
| --- | --- |
| `currencies` | Reference data — the same rows for every user. Not theirs, and each transaction already carries its own currency code and locked `exchange_rate`. |

`delete_own_account()` never needs this list: every user-owned table references
`auth.users (id) on delete cascade`, so deleting one row erases all of it. Export has no such
shortcut — it must enumerate — and a hand-written list of sixteen is exactly the artefact that is
still sixteen long when the schema has nineteen tables. The resulting bug is an archive that is
silently missing a table, discovered by a user who deleted their account believing they had a copy.

So the list is not trusted on its own. `lib/export/manifest.test.ts` copies the approach already
proven in `lib/ask/schema-doc.test.ts`, which reads the generated types on the stated grounds that
unlike a hand-written fixture they "cannot be updated to agree with a mistake":

1. Every `public` table with a `user_id` column appears in `EXPORT_TABLES`.
2. Every table in `EXPORT_TABLES` still exists in the schema.
3. Anything omitted is named in `NOT_EXPORTED` with a reason string, so omission is a decision on
   the record rather than an oversight.

Add a table and forget this file and the suite goes red. That is the whole point of the section.

Regenerating types is a manual step (`npm run db:types`), so the test is one migration behind until
someone runs it. That is the same exposure `schema-doc.test.ts` already accepts, and it is a far
smaller window than no check at all.

## 3 · Paging is a correctness requirement, not an optimisation

Every table is read through a keyset loop, including the one-row ones.

Not for memory. PostgREST applies a server-side row cap, and a `select("*")` that reaches it returns
`200 OK` with fewer rows and no error of any kind. That is precisely the defect UX-04 and CHK-04
were about — and in an archive it is far worse than in a ledger. A user scrolling a ledger can see
where it stops. A user holding a JSON file cannot, and the whole purpose of the file is to be the
copy they keep when they delete the original.

`lib/transactions/queries.ts:83` already has the honest pattern: order by a total ordering, request
`pageSize + 1`, and treat a full page as proof there is more, because "a page that comes back
exactly full is otherwise indistinguishable from the last." `paginate.ts` generalises it, keyed on
`(occurred_at, id)` for `transactions` and on `id` elsewhere — `id` alone is a total order, which is
what the cursor needs and what `occurred_at` alone is not.

## 4 · The CSV

One header row, then every transaction, newest first. Names are joined in rather than UUIDs, reusing
the existing `TXN_SELECT` (`lib/transactions/queries.ts:10`) which already joins the source account,
the destination account and the category.

Columns, in order (shown here in es; the en catalogue carries the same order under English names):

`fecha · tipo · cuenta · cuenta_destino · categoría · descripción · notas · monto · moneda ·
impuesto · comisión · total · tasa_cambio · total_base · moneda_base · solo_presupuesto · id`

Decisions, each with its reason:

- **Headers follow the reader's locale** (es/en). This is a human artefact meant for a spreadsheet;
  the JSON in §5 is the canonical machine copy, so the CSV is free to be readable instead.
- **UTF-8 with a byte-order mark.** Without it Excel renders `Alimentación` as mojibake, and for a
  Spanish-first product that reads as the whole file being broken.
- **Comma-delimited, `.` decimals, ISO `YYYY-MM-DD` dates.** RFC 4180. The known cost: Spanish-locale
  Excel expects `;` and will drop each row into a single cell until the user goes through the import
  wizard. Accepted deliberately — Google Sheets dominates on mobile here and handles commas, and
  changing the delimiter breaks every `jq`, pandas, and Numbers consumer instead. Standard wins.
- **Quoting is RFC 4180 and gets its own tests.** `description` and `notes` are free text, and
  `notes` exists precisely to hold things like `CARDNET PEAJES-RS, ida y vuelta` — a comma inside a
  field is the ordinary case, not the edge one.
- **`id` last**, so any row can be traced back into the app.
- **A deleted category or destination account exports as an empty field**, not the string `null`.
  Both FKs are `on delete set null`, so this is a real state, not a defect.
- **Money is written as the value the app itself holds.** `numeric(18,4)` arrives from `supabase-js`
  as a JS number and is not re-serialised through text. An archive whose figures disagreed with the
  screens would be the worse artefact; the precision loss only begins above ~10¹¹, a
  hundred-billion-peso row.

Filename is locale-aware — `cashly-transacciones-2026-08-21.csv` / `cashly-transactions-…` — dated
in UTC, matching how `occurred_at` bounds are already handled (`lib/transactions/queries.ts:56`).

## 5 · The JSON

The envelope, matching the shape approved during design — top-level keys per table, no nesting:

```json
{
  "format": 1,
  "exported_at": "2026-08-21T18:22:04.123Z",
  "app": "Cashly",
  "user": { "id": "…", "email": "…" },
  "profile": { "base_currency": "DOP", … },
  "accounts": [ … ],
  "transactions": [ … ]
}
```

Raw rows. UUIDs intact. No id remapping, no restore path, and no compatibility promise made anywhere
in the copy. `format: 1` dates the file, which costs nothing now and is the one thing a future
importer would need that cannot be added retroactively.

`user.email` comes from `auth.getUser()` rather than a table: it lives in `auth.users`, which is not
in the manifest, and an archive of someone's account that omits the address identifying it would be
a strange document.

Written table by table into the stream so a long history never sits in memory whole.

## 6 · Rate limiting

A full-history read is the most database-expensive request in the app, and a held-down download
button issues them as fast as the network allows.

`lib/ask/rate-limit.ts` already implements the right mechanism — an in-memory sliding window, `now`
passed as a parameter so the window is testable without waiting for it. Its reasoning about *why* it
is in memory and not a table is specific to `/ask` and stays there. The 25 lines of bucket
underneath are extracted to `lib/rate-limit.ts` as `tokenBucket({ max, windowMs })`;
`lib/ask/rate-limit.ts` keeps its name, its constants, its comment and its `resetAskRateLimit` seam
and delegates. Behaviour there is unchanged, and its existing tests must still pass untouched — that
is the check on the refactor.

Export takes `EXPORT_MAX_PER_WINDOW = 6` per `EXPORT_WINDOW_MS = 10 min`. Two files is two requests,
so that is three complete exports per ten minutes: generous for the honest case, including a retry
after a failure, and useless for a loop. Over the limit returns `429`.

The same caveat applies as for `/ask`: best-effort per instance, undercounting across a fleet. A real
limiter belongs in front of the app.

## 7 · Failure, and the one risk that stays

Once a stream has sent its headers the status code cannot be taken back. On any mid-stream read error
the route calls `controller.error()`, so the browser reports a failed download rather than saving a
short file that looks complete.

JSON fails closed for free: an aborted stream leaves unterminated JSON and every parser rejects it.

**CSV has no such property.** A truncated CSV is a perfectly valid CSV, and a user who receives one
has a file that is wrong in a way nothing will tell them. There is no clean fix inside the format —
a footer sentinel would pollute the spreadsheet, and `Content-Length` cannot be known before the
read. The mitigations are that the paging loop is shared, tested code rather than a per-table
improvisation (§3), and that `controller.error()` at least prevents the common case of a clean
truncation being written to disk as a normal file. This residual risk is recorded rather than solved.

## 8 · Settings, and the two promises

`components/settings/settings-panel.tsx` renders an indexed `Row` list, currently 0–9, above a
danger-zone block. Export becomes rows 10 and 11 — after the rules link, immediately before the
delete block, so the copy and the destructive action a user has to read past sit next to each other:

```
  Descargar transacciones (CSV)      Para Excel o Google Sheets.
  Descargar todos mis datos (JSON)   Todo lo que Cashly guarda de ti.
  ─── Danger zone ───
  Eliminar mi cuenta
```

Both are plain `<a href download>` anchors, not client-side fetches: a GET that returns a file is
what an anchor is for, it works with no JavaScript, and it keeps the browser's own download UI.

Copy lands in both catalogues. The catalogues are at exact parity today (932 keys each) with nothing
enforcing it, so this adds `messages/parity.test.ts` — a ten-line bidirectional key comparison. That
is slightly beyond BUILD-07's letter and is included because this change touches both files and the
failure it prevents is a missing Spanish string in a Spanish-first product.

The marketing CTA and Terms §6 need no edit: they simply become true. Privacy §6's "contact us for
help exporting" changes to name Settings, since that sentence documents a manual process that no
longer exists. The help guide is updated per the standing rule, until CUT-01 retires it.

## 9 · Testing

| File | What it pins |
| --- | --- |
| `lib/export/manifest.test.ts` | Bidirectional drift against `lib/supabase/types.ts` (§2) |
| `lib/export/paginate.test.ts` | A table with more rows than one page yields every row |
| `lib/export/csv.test.ts` | Quoting of commas, quotes and newlines; BOM; header order; locale headers; null joins as empty; payment rows carrying both accounts |
| `lib/export/serialize.test.ts` | Envelope shape; `format: 1`; top-level keys equal the manifest |
| `lib/export/rate-limit.test.ts` | The window, and that `/ask`'s existing tests still pass unchanged |
| route tests | `401` unauthenticated, `429` over the limit, and the `no-store` + `Content-Disposition` headers |
| `messages/parity.test.ts` | en/es key parity, both directions |

Run with `npx vitest run` directly, and confirm the reported **file** count as well as a green pass —
proxied output has previously reported a green suite when an entire file failed to load.

## 10 · Out of scope

| Not built | Why |
| --- | --- |
| An importer / restore | The dump is an archive by decision. Round-tripping needs a versioned contract, UUID remapping across 16 tables, FK insert ordering, and conflict rules — its own project, not a day. `format: 1` leaves the door open. |
| Zip packaging | A dependency and a buffer, to make the most-wanted file harder to open on a phone (§1). |
| Filtered export from `/transactions` | Genuinely useful and deliberately deferred. The route can grow query params later; `applyTxnFilters` (`lib/transactions/queries.ts:46`) already parses exactly the filters it would need. One entry point means one meaning: Settings exports everything. |
| Email / async delivery | The dataset is thousands of rows, not millions. A synchronous stream is the right size of solution. |
| PDF statement copies | There are none to export. The `statements` bucket was created in `20260722120000` and dropped again in `20260722170000_drop_statements_bucket.sql`; `statement_imports.file_path` is vestigial and exports as `null`. |
