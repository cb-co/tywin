# Categorisation triage and merchant rules (UX-03 / BUILD-13)

**Date:** 18 Aug 2026
**Audit items:** UX-03 · Fix · High — *"After an import, categorising 80 lines is 80 dialogs"*
and BUILD-13 · Medium — *"Merchant rules, surfaced"*
**Audit doc:** `docs/product-audit-dominican-market.md`

## Why

`saveMerchantRule` works (`app/(app)/accounts/statement-actions.ts:527`) and the importer already
consults every rule it finds (`resolveCategoryId`, `lib/statements/categorize.ts:26`). What is missing
is any way for a person to reach either one. Today the only path to a rule is: open one transaction,
change its category, tick a checkbox (`components/transactions/transaction-form.tsx:347`). A Banco
Popular statement produces up to a hundred lines. Nobody does this a hundred times, so the rules table
stays empty, so the next import is just as manual as the last — the loop that was supposed to make the
app learn never starts.

UX-02 made this worse on purpose: more imports means more runs of uncategorised rows. This item is the
relief.

Two facts from the sample statement (`extracted-statement.json`, a real Banco Popular export) set the
design:

- **Descriptions repeat byte-identically.** `SM NACIONAL METRO PLZA SANTO DOMINGO-DO` appears six
  times, character for character. 33 lines collapse to 19 distinct merchants, 13 of them singletons.
  Grouping by description needs no fuzzy matching to work.
- **Every line has a null MCC.** The MCC ladder in `resolveCategoryId` — both user MCC rules and
  `MCC_DEFAULT_CATEGORY` — contributes nothing for this issuer. Merchant rules carry all the weight,
  which is why triage saves one on every assignment rather than offering it as an option.

## Scope

In:

1. A null category, writable only by the importer (§1).
2. Uncategorised spend made visible in Insights and Budgets rather than dropped (§2).
3. A triage screen, per import, grouped by merchant (§3).
4. `merchantPattern`, the one normalisation step rules are built from (§4).
5. A rules screen under Settings: list, edit, delete, usage count (§5).
6. Entry points: after an import, and from a statement in the panel (§6).
7. Copy at en/es parity, and the help guide updated (§7).

Out, with reasons in §8: undo on a triage assignment, retroactive re-categorisation when a rule
changes, a standing cross-import queue, backfilling the `Other` rows that earlier imports already
wrote.

## 1 · The null category

**The problem with `Other`.** The importer's last resort is the category named `Other`
(`statement-actions.ts:397`, `resolveCategoryId(..., otherId)`). That conflates two different states —
*the app could not tell* and *the user means miscellaneous* — and it assumes every user has a category
called `Other` at all. Categories are per-user rows (`categories.user_id`), seeded but freely editable;
a user who renames or deletes it gets `cats?.[0]?.id`, whatever that happens to be. Triage keyed on
"category is Other" would therefore both trap people who genuinely chose `Other` in a queue that never
empties, and miss users who have no such category.

**A null category means "nobody has said what this is".** For an imported line that is the importer
admitting it could not tell — the case triage exists for.

| Path | Rule |
| --- | --- |
| Import (`import_card_statement`) | May write null |
| Manual entry / edit | Required — already enforced, `lib/transactions/schema.ts:40` |
| Subscription charges | May write null — `category_id` stays optional, see (c) |
| Income | Null, as today (income has no category, `schema.ts:42`) |

`transactions.category_id` is already nullable (`20260717234227_transactions.sql:7`) — but the column
is not the only thing standing in the way. **A table CHECK constraint forbids exactly this**
(`20260717234227_transactions.sql:36-37`), and no later migration touches it:

```sql
  constraint expense_requires_category
    check (type <> 'expense' or category_id is not null),
```

Every imported line is inserted as `type = 'expense'`, so without changing this a null category fails
at the constraint instead of at the ownership guard — the same broken import, one line further down.
This was missed when the spec was first written and found during implementation.

The constraint is replaced rather than dropped, because what it protects is still worth protecting.
The new one encodes the table above directly: an expense may lack a category only when it came from an
import or from a subscription charge.

```sql
alter table public.transactions drop constraint expense_requires_category;
alter table public.transactions add constraint expense_requires_category
  check (
    type <> 'expense'
    or category_id is not null
    or statement_line_id is not null
    or subscription_id is not null
  );
```

Adding a CHECK validates existing rows, and every expense written under the old constraint has a
category, so the weaker constraint passes trivially — no backfill, no failure on apply.

Manual entry is still guarded at the database, not only by `lib/transactions/schema.ts:40`: a
hand-entered expense sets neither `statement_line_id` nor `subscription_id`, so a null category on one
is still rejected by Postgres.

So this is not a column change, but it is four things, not three.

**a) The import RPC must accept it.** The current guard runs on every non-payment line
(`20260806120000_statement_cashback.sql:146-152`):

```sql
if not exists (select 1 from public.categories
               where id = (ln->>'category_id')::uuid and user_id = v_user)
then raise exception 'category % does not belong to you', ln->>'category_id';
```

An empty string dies on the `::uuid` cast before the guard speaks. The new migration makes the check
conditional on a non-empty value and inserts `nullif(ln->>'category_id','')::uuid`. The ownership
check itself stays exactly as strict for every value that *is* supplied — this widens the accepted set
by one member, null, and by nothing else.

**b) `resolveCategoryId` returns `string | null`.** The `otherId` parameter goes away. The ladder is
otherwise unchanged: merchant rule → MCC rule → LLM suggestion → `MCC_DEFAULT_CATEGORY` → **null**.
The `noCategories` early return in `confirmStatementImport` goes with it; a user with no categories now
imports successfully and lands every line in triage, which is a better failure than a blocked import.

**c) Subscriptions keep their optional category.** `lib/subscriptions/schema.ts:12` leaves
`category_id` optional, so `addCharge` (`app/(app)/subscriptions/actions.ts:239`) can also insert a
null-category expense. This is left exactly as it is — a decision, not an oversight. Forcing a category
onto a subscription would make every existing one un-editable until its owner picked something, to
close a hole that costs nothing: a subscription is a named, recurring row the user created on purpose,
and it is one tap to categorise in the ledger whenever they care to.

The consequence, stated so nothing downstream assumes otherwise: **a null category does not imply the
row came from an import.** Triage is scoped to an import's own statement lines (§3), so a subscription
charge can never appear in it — but it does count toward the uncategorised figures in §2, where the
ledger is the way to fix it. Any future code that reads "null category" as "imported and untriaged"
would be wrong.

**d) The extractor is told null is a right answer.** `lib/statements/llm/system-prompt.ts:50` already
permits null, but frames guessing as free: *"a downstream rules system has final say, don't worry about
being wrong"*. That is an instruction to guess. It becomes the opposite: a wrong guess is worse than
null, because null asks the user one question in triage while a wrong guess silently mis-files money.
`suggestedCategory` is already `z.string().nullable()` (`lib/statements/llm/schema.ts:46`), so the
contract is unchanged.

## 2 · Where uncategorised money shows up

Both category aggregates currently drop null rows, so this change would quietly shrink the numbers:

- `spend_distribution` (the Insights donut) filters `and t.category_id is not null`
  (`20260731150000_spend_distribution_payments.sql`).
- `category_usage` (the budget bars) joins **from** `categories`
  (`20260731130000_card_payment_default_and_cashflow.sql:6-45`), so a null-category row cannot appear
  in it by construction.

Leaving both alone would mean RD$18,000 of un-triaged spend vanishing from Insights and Budgets with
nothing said — the same silent-wrong-total shape CHK-03 was just fixed for. So:

**The donut gets a real slice.** Drop the `is not null` filter from `spend_distribution`. The client
mapper already tolerates a null key — `catById.get(d.category_id ?? "")?.name ?? "Uncategorized"`
(`lib/insights/queries.ts:103`) — but that string is hardcoded English and the colour falls through to
the `CHART_FALLBACK` rotation, so it would land on whatever hue the index gives it. Give it a
translated name and a deliberate muted grey, so it reads as absence rather than as another category.

The slice is **not** a link. Making one requires a click handler on a Recharts `Pie` plus a second data
dependency on the Insights page, which would otherwise have no reason to know which import has
leftovers — all to duplicate a link the Budgets line already carries as plain text. The donut's job
here is to stop hiding the money; the actionable link lives one page over, where it reads as a task
rather than as a chart affordance.

**Budgets get a line, not a bar.** Budgets are per category; there is no honest bar for spend that has
no category. Above the bars: *"RD$18,000 sin categorizar — categorizar"*, linking into triage, hidden
at zero. The figure comes from a new `uncategorized_spend(p_month date) returns numeric` in the same
migration, mirroring `category_usage`'s inclusion rule exactly (`type in ('expense','payment')`, not
`exclude_from_budget`, card payments handled the same way) so the two cannot disagree about what counts.

**Where those links go.** To the newest import that still has uncategorised lines. When more than one
import has leftovers the copy says so; older ones stay reachable from their statement (§6). When no
import has leftovers — the figure is entirely subscription charges (§1c) — the slice and the line render
as plain figures with no link, because triage has nothing to offer them.

## 3 · The triage screen

**Route:** `app/(app)/imports/[id]/page.tsx`. A page rather than a step in the import dialog: a modal is
the wrong container for 20–80 groups, and being a route is what makes the re-entry point in §6 free
rather than a second copy of the UI.

**Query** — `getImportTriage(importId)` in `lib/statements/triage.ts`:

- `card_statements` where `import_id = :id` (RLS confines it to the owner).
- their `card_statement_lines`, joined to `transactions` on `transaction_id`.
- payment lines are excluded — they never get a transaction at all (`cashback.sql:146`).
- **needs triage** = the joined transaction's `category_id is null`. No rule lookup, no comparison
  against a category name. This is the whole benefit of §1.

Grouping happens in TypeScript, in a pure function so it can be tested without a database:

```ts
groupForTriage(lines): TriageGroup[]   // { pattern, description, count, total, currency, txnIds, firstDate, lastDate }
```

Sorted by count descending, then total descending — the merchant that costs the most taps first. On the
sample statement that is `SM NACIONAL METRO PLZA` (6 lines) before eleven singletons.

**The header states the win**, in the audit's own words: *"68 de 80 categorizadas automáticamente —
faltan 12"*. The denominator is every non-payment line in the import; the numerator is those with a
category. This is the sentence that makes the rules system visible to someone who never opens Settings.

The word *automáticamente* is only true on arrival from the import, before the user has assigned
anything — nothing records whether a category came from a rule or from a person, so on a later visit
that figure is unrecoverable. The post-import redirect therefore carries a marker (`?fresh=1`) and
shows the automatic sentence; every other entry shows the plain one, *"faltan 12 por categorizar"*.
Showing the automatic wording on re-entry would credit the rules engine with the user's own taps.

**Each group** is one card: merchant, line count, total, date range, and a `CategoryRail`
(`components/transactions/category-rail.tsx`, reused unchanged — five most-used categories one tap
away, full list behind *more*). Assigning:

1. every still-null transaction in that group gets the category,
2. a merchant rule is upserted (§4) — silently, by design: one tap has to do both jobs or the rules
   table stays empty, and the rules screen (§5) is the correction surface,
3. the group leaves the list and the header count moves.

**Keyboard**, on desktop: ↑/↓ move between groups, digits 1–9 pick from the rail. The audit asks for
keyboard-navigable and this is the cheap version of it.

**Empty state** is the exit: *"todo categorizado"* plus a link back to the account.

**Server action** — `categorizeTriageGroup(importId, description, categoryId)` in
`app/(app)/imports/actions.ts`:

- the category must belong to the caller (explicit check, as the RPC does — RLS does not police *which*
  category id an update writes),
- resolve the group's transaction ids through the import, never from the client: the client sends a
  description, the action derives the rows. A client-supplied id list would let a caller write a
  category onto any transaction of theirs from a screen that is supposed to touch one import.
- update only rows still `category_id is null`, so a concurrent edit in the ledger wins rather than
  being overwritten,
- upsert the merchant rule,
- revalidate `/imports/[id]`, `/transactions`, `/budgets`, `/insights`, `/` — the same set the import
  path already revalidates, for the same reason.

## 4 · Merchant patterns

`merchantPattern(description)` in `lib/statements/merchant.ts`: uppercase, collapse internal
whitespace, trim. Nothing else.

The temptation is to strip the location tail — `SANTO DOMINGO-DO`, `DISTRITO NACI-DO` — so a rule
survives the same merchant at another branch. Every regex that does it is greedy in the wrong place:
`\s+[A-Z][A-Z ]*-[A-Z]{2}$` turns `IN&OUT CHARLES SUMMER SANTO DOMINGO-DO` into `IN&OUT`, which then
matches by `includes` against anything beginning with those six characters. An over-matching rule
mis-files money silently; an under-matching one costs one extra tap next month. The asymmetry decides
it.

Rules are matched with `desc.includes(pattern)` (`categorize.ts:34`), so a full-description pattern
matches every repeat of that merchant — which, per the sample, is all of them. Someone who wants
`SM NACIONAL` to cover every branch can shorten the pattern by hand in §5. That is the feature that
justifies the pattern being editable there.

## 5 · The rules screen

**Route:** `app/(app)/settings/rules/page.tsx`, linked from `SettingsPanel`. A route rather than
another section in the panel, which is already 8.7K and about profile settings, not a list of records.

Each row: rule type (`merchant` / `mcc`), the pattern as an editable text field, the category as a
select, and **how many statement lines it has matched**. The count is what turns an abstract list into
something a person can judge — a rule matching 40 lines is load-bearing, one matching 0 is a typo.

The count comes from a new `category_rule_usage()` in the same migration: for each of the caller's
rules, the number of `card_statement_lines` whose description contains the pattern (or whose MCC equals
it, for MCC rules). A rules × lines join at personal scale — tens of rules, low thousands of lines — is
nothing.

Editing a pattern or category writes through the existing unique key `(user_id, rule_type, pattern)`.
Deleting removes the row.

**Editing a rule changes future imports and future triage only.** It does not rewrite transactions
already categorised. Retroactive re-categorisation is a large hammer — it would silently rewrite months
of history, including rows the user hand-corrected afterwards — and it is out of scope here. The screen
says so in one line rather than letting people discover it.

## 6 · Entry points

**After an import.** `import_card_statement` already returns the import id
(`cashback.sql:172`, `returns uuid`), and `confirmStatementImport` throws it away
(`statement-actions.ts:459`). Return it instead; the dialog's `onConfirm`
(`statement-import-dialog.tsx:186`) closes and routes to `/imports/[id]`. **No migration is needed for
the handoff** — only for §1 and §2.

If the import produced no uncategorised lines, skip the redirect entirely and keep today's success
toast. Landing someone on an empty triage screen to congratulate them is worse than saying nothing.

**Later.** `StatementsPanel` (`components/accounts/statements-panel.tsx:122`) lists past statements per
card. Each row whose `import_id` still has uncategorised lines gets a *categorizar (12)* action to the
same route. This is what makes triage abandonable without becoming a dead end — the audit's queue, held
by the statement it came from rather than by a global list.

## 7 · Copy and help

New keys in `messages/en.json` and `messages/es.json` at parity: the triage header and its counts, the
group card, the empty state, the donut's uncategorised slice, the budget line, the rules screen and its
retroactivity note. Spanish is the primary audience — write it first and translate to English.

Per the standing rule, the help guide moves in the same change (page, mocks, both languages): the
import section gains what happens *after* an upload, and Settings gains the rules screen.

## 8 · Deliberately out of scope

**Undo on a triage assignment.** Rules are saved silently, so the correction surface is the rules
screen — that is the trade that was chosen deliberately. A per-assignment undo would mean reverting a
category on N rows and deleting a rule that may have already matched others; it is its own feature.

**Retroactive re-categorisation** when a rule is edited (§5).

**A standing cross-import queue.** Triage is per import, entered after an upload and re-entered from a
statement. A global "everything uncategorised, all time" list was considered and rejected: it turns a
ritual attached to a specific statement into a chore that is never finished.

**Backfilling the `Other` rows earlier imports already wrote.** They carry a real category and are
indistinguishable from a deliberate choice — exactly the ambiguity §1 exists to prevent. They stay put
and never appear in triage.

**An "uncategorised" filter on the ledger.** It would make the §2 figures actionable even when no
import has leftovers, and it is a small change — a sentinel in `txnFilters` resolving to
`.is("category_id", null)`. It is left out because it is one step from the standing cross-import queue
that was rejected above, and the case it serves is a subscription the user chose not to categorise.
Worth revisiting only if that figure turns out to sit above zero for long.

**Bank-account statements (BUILD-02)** and the `notACard` gate: untouched.

## 9 · Testing

- `merchantPattern`: collapses whitespace, uppercases, trims; leaves the location tail alone; is
  idempotent.
- `resolveCategoryId` returns null when nothing matches, and still prefers merchant rule → MCC rule →
  LLM suggestion → MCC default in that order. Existing tests in `categorize.test.ts` assert
  `"cat-other"` for the no-match cases and must change to null.
- `groupForTriage`: 33 sample lines → 19 groups; the six-line merchant sorts first; a payment line is
  never grouped; a line whose transaction has a category is excluded.
- `categorizeTriageGroup`: writes only null-category rows; rejects a category belonging to another
  user; derives its own transaction ids rather than trusting the caller; upserts exactly one rule.
- The transaction schema still rejects a manual expense without a category; the subscription schema
  still accepts one without (both unchanged — the tests pin them so the null state cannot quietly
  spread to manual entry).
- `getImportTriage` excludes a null-category subscription charge on the same account and month: triage
  reads statement lines, not transactions-with-no-category.
- Insights distribution renders a null-category row as the uncategorised slice with the muted colour,
  not a rotation colour.
- Statement panel shows *categorizar (n)* only for imports with leftovers.

## 10 · Risks

- **Silent rule creation surprises someone.** Accepted, and mitigated by §5 shipping in the same change
  — every rule is listed, editable and deletable. The alternative, an opt-in checkbox, is what produced
  today's empty rules table.
- **A full-description pattern is narrow**, so the same merchant at a different branch asks again next
  month. Accepted: one extra tap, versus an over-broad rule mis-filing money invisibly (§4).
- **Uncategorised spend now shows as its own slice**, which will look like a regression to anyone who
  read the donut as complete. It is the opposite — the money was previously filed under `Other` as
  though someone had chosen it.
- **A subscription without a category** produces null-category charges that never appear in triage, by
  design (§1c). They do appear in the donut slice and the budget line, where the count can therefore
  exceed what triage offers to fix — someone who empties every triage queue may still see a non-zero
  uncategorised figure. The copy on those two surfaces says *sin categorizar*, not *sin triar*, so it
  stays true either way; when no import has leftovers the figure simply stops being a link (§2), since
  the only place to fix such a row is the transaction itself.

## 11 · Migration hand-off

One migration, `supabase/migrations/2026xxxxxxxxxx_null_category_triage.sql`:

1. `import_card_statement` — conditional ownership guard, `nullif(...)` insert (§1a).
2. `spend_distribution` — drop the `is not null` filter (§2).
3. `uncategorized_spend(p_month date)` — new (§2).
4. `category_rule_usage()` — new (§5).

**This repo is linked to a live Supabase project and the migration cannot be pushed from here.** It
will be written and left for you to apply.

**The migration must land before the app-side change, not alongside it.** These are not independent:
once `resolveCategoryId` can return null, `confirmStatementImport` sends `category_id: ""` for any
unresolved line, and the old RPC dies on `''::uuid` with an invalid-input-syntax error before its
ownership guard ever runs. An app deploy that arrives first does not degrade — it breaks every import
containing a single unrecognised merchant, which is every import. Apply the migration, confirm it, then
deploy.
