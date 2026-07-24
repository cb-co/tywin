# Statement Import Performance, Route Skeletons & Button Loading States — Design

**Date:** 2026-07-24
**Status:** Approved direction, pending spec review

## 0. Background

Four related complaints surfaced after `2026-07-23-llm-statement-extraction-design.md` shipped
(Groq → Gemini, PII scrub in front of the LLM call):

1. Navigating `/accounts` → `/accounts/[id]` and back has no loading feedback — feels frozen.
2. Buttons that trigger a long-running action just go `disabled` — same frozen feeling.
3. The **Import** button (confirm step, after the preview already parsed the PDF) got
   noticeably slower than before the LLM switch, even accounting for the LLM call itself.
4. Question: does one user's import block another user's?

Investigation (this session, no code changed yet) answered 3 and 4 directly:

- **(4) No blocking.** Deployed on Vercel; `parseStatement`/`confirmStatementImport` are
  Server Actions, each an isolated serverless invocation. No lock/queue/mutex/shared
  in-memory state exists anywhere in `lib/` or `app/`. Supabase RLS scopes every DB write to
  `auth.uid()`, so concurrent imports from different users never contend. The only
  process-wide shared resource is the debug file (`extracted-statement.txt`, see §9 of the
  prior spec) — it can only race with itself on a long-lived Node process (not Vercel), and
  even then it only corrupts the debug dump, never blocks a request.
- **(3) Root cause found**, see §1 below.

## 1. Root cause: Import re-runs the entire extraction pipeline

`runPipeline(formData)` (`app/(app)/accounts/statement-actions.ts:56-157`) is shared, per its
own comment, by "parse and confirm: extract → detect → parse → checksum." Both
`parseStatement` (the initial file-select/preview step) and `confirmStatementImport` (the
**Import** button) call it in full — meaning every Import click re-reads the PDF bytes,
re-extracts text via pdfjs, re-writes the debug file, re-scrubs PII, and **re-calls Gemini**,
before doing anything the confirm step actually needs (account mapping validation, category
resolution, the DB write).

Before the LLM work, the "redo this on confirm" step was `detectParser()` — cheap, local,
synchronous regex matching. Moving that step behind an LLM network call (Groq, then Gemini)
turned a free redundancy into an expensive one; nobody hit ~2x Gemini latency until now.

**Fix:** stop re-deriving the parsed statement on confirm. Split `runPipeline` into:

- **`extractAndParse(formData)`** — the expensive, LLM-touching half: file read →
  `extractStatementText` → debug write → `scrubPii` → `extractWithLLM` → `toParsedStatement`
  → `validateChecksums`. Called only from `parseStatement`.
- **`loadAccountContext(accountId, parserId)`** — the cheap half: the account row, card-group
  sibling accounts, and saved `statement_section_mappings` lookups. Called from both
  `parseStatement` (still needed to compute suggested mappings for the preview) and
  `confirmStatementImport`.

`parseStatement`'s return type (`StatementPreviewResult`) gains the full `ParsedStatement` it
already computed (it's a plain JSON-serializable interface — no `Date`s, see `types.ts` — so it
round-trips through a hidden form field with no extra work). The client
(`statements-panel.tsx`) stores it in state next to the existing `preview` summary.

On **Import**, `onConfirm` sends that stored `ParsedStatement` back as a JSON string instead of
re-uploading the raw `File`. `confirmStatementImport`:

1. Parses `mappings` (unchanged) and the new `parsed_statement` field, with the same
   lightweight shape guard already used for `mappings` on that line (not a new trust
   boundary — a caller could already forge arbitrary `FormData` today; this doesn't add
   attack surface, it removes redundant recomputation of data the request already trusts).
2. Re-runs `validateChecksums()` on it — cheap, pure, defense-in-depth against a
   corrupted/stale payload (e.g. stale client state after a slow retry).
3. Calls `loadAccountContext(accountId, parsed.parserId)` for the account/options/saved-mapping
   data it still needs.
4. Continues exactly as today from "every section must land on a currency-matching card" —
   no other logic changes.

No PDF bytes, no pdfjs re-extraction, no debug write, and no second Gemini call happen on
confirm. `needsPassword`/`passwordIncorrect` handling is unaffected — those only ever occur
during `parseStatement` (confirm can no longer hit that branch, since it never re-parses).

**Files touched:** `app/(app)/accounts/statement-actions.ts`,
`components/accounts/statements-panel.tsx`.

## 2. Route skeletons

There is exactly one `loading.tsx`, at `app/(app)/loading.tsx`, scoped to the entire `(app)`
route group. Because Next only re-triggers a segment's `loading.tsx` boundary on navigations
that cross into a differently-rendered part of that segment, navigating between two pages that
both sit under the same group-level boundary (e.g. `/accounts` → `/accounts/[id]`) shows
nothing — the "frozen" symptom.

Add one `loading.tsx` per top-level route, each shaped to approximate that page's real
layout (matching what the equivalent group-level skeleton already does for width/rows/cards),
reusing the existing `.skeleton` utility class (`app/globals.css:321-345`) — no new CSS, no
`Suspense` boundaries (the app uses none anywhere; staying consistent with the established
file-convention-only pattern):

- `app/(app)/page.tsx` (dashboard)
- `app/(app)/accounts/page.tsx`
- `app/(app)/accounts/[id]/page.tsx`
- `app/(app)/subscriptions/page.tsx`
- `app/(app)/budgets/page.tsx`
- `app/(app)/insights/page.tsx`
- `app/(app)/transactions/page.tsx`
- `app/(app)/settings/page.tsx`

The existing `app/(app)/loading.tsx` stays as-is as the fallback for any route without its own
(there are none left after this, but it's cheap to keep as a safety net).

## 3. Lazy-loading the chart components

The four recharts-based components are the heaviest client bundles in the app and currently
load eagerly with their parent page:

- `components/accounts/balance-chart.tsx`
- `components/insights/spending-pace.tsx`
- `components/insights/spend-donut.tsx`
- `components/insights/cashflow-chart.tsx`

Wrap each in `next/dynamic` with `ssr: false` and a `loading` fallback built from `.skeleton`
divs sized to that chart's real dimensions, so recharts' JS bundle no longer blocks first paint
of `/accounts/[id]` or `/insights`. This is additive at the import site only — no change to the
chart components themselves.

## 4. Button loading states

No `isLoading`/spinner convention exists today — every async button just does
`disabled={pending}` (from `useTransition`), and roughly half also swap their label text
(`"Saving..."` etc.). No spinner icon appears anywhere in the app's buttons; the only spinner
in the codebase is Sonner's own toast icon.

Add an `isLoading?: boolean` prop to the shared `Button`
(`components/ui/button.tsx`):

```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { isLoading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  );
}
```

`Button` always prepends the spinner ahead of `children` when `isLoading` — no branching inside
`Button` itself. Two cases at the call site, both a one-line change:

- **Labeled buttons** (most of the inventory) — keep the existing icon and
  `{pending ? t("saving") : t("save")}`-style label untouched, just add `isLoading={pending}`.
  The button reads as spinner + icon + label while loading.
- **Icon-only buttons** (`size="icon"`/`"icon-sm"`/`"icon-lg"`, e.g. the delete/expand-lines
  buttons in `statements-panel.tsx` and `transaction-row.tsx`) — there's no room for both, so
  the call site omits its own icon while loading instead of adding a second condition to
  `Button`: `{isLoading ? null : <Trash2 className="size-4" />}`. `Button`'s unconditional
  prepend then renders just the spinner.

Roll `isLoading={pending}` (or the specific local pending flag already in scope, e.g.
`namePending`/`deletePending` in `settings-panel.tsx`) out to every async button found in the
earlier audit — full list in the implementation plan, spanning: `statements-panel.tsx` (import,
retry, confirm, expand-lines, delete), `account-detail-actions.tsx` (archive/restore, delete),
`transaction-row.tsx` (delete), `transaction-form.tsx` (submit), `account-form-dialog.tsx`
(submit), `subscription-form-dialog.tsx` (submit), `subscriptions-view.tsx` (add-charge,
delete ×2 each), `budget-grid.tsx` (copy-last-month, delete-category), `category-dialog.tsx`
(submit), `settings-panel.tsx` (save name, delete account), `welcome-flow.tsx` (continue/finish),
`login-form.tsx` (Google sign-in, submit), `language-switcher.tsx` (trigger).

Buttons that only *open* a dialog/file-picker (not themselves async) are left untouched —
already listed as non-async in the audit.

## 5. Non-goals

- No change to `runPipeline`'s error-telemetry inserts (`statement_imports` failure rows) —
  those still only fire from `extractAndParse`, on the initial parse attempt, which is where
  they were meaningful before.
- No manual `React.Suspense` boundaries introduced — staying consistent with the app's
  existing file-convention-only loading pattern.
- No new spinner/skeleton library — `lucide-react`'s `Loader2Icon` and the existing
  `.skeleton` CSS class cover both needs.
- Not fixing the debug-file race in §9 of the LLM-extraction spec (harmless on Vercel, cosmetic
  off it) — out of scope for this change.

## 6. Testing

- `lib/statements/` unit tests (vitest, colocated `*.test.ts`): add coverage that
  `confirmStatementImport` given a valid `parsed_statement` payload does not call
  `extractStatementText`/`extractWithLLM` (mock both, assert zero calls) and still produces the
  same `import_card_statement` RPC payload as today's full-pipeline path for an equivalent
  input.
- Manual verification in dev: confirm Import no longer shows a second Gemini round-trip in
  server logs/timing, confirm skeletons render on `/accounts` ↔ `/accounts/[id]` navigation
  (including back button) and on the other listed routes, confirm chart panels show a
  skeleton then swap in, confirm buttons show a spinner during their existing `pending` window.
