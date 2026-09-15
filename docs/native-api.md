# Native API contract (v1)

This is the document the Expo repo's data layer is built from. It has two halves: the HTTP contract for
the five `/api/v1` endpoints (Task 4), and the lane map that says, for every one of the 54 server actions
in this repo, whether the native app calls Supabase directly, calls one of these endpoints, or uses
supabase-js Auth instead.

## Authentication

- Sign in on the device with supabase-js (`signInWithPassword`, `signInWithIdToken` for Google/Apple).
- Every `/api/v1` call sends `Authorization: Bearer <session.access_token>` and `Accept-Language: es` or `en`
  (the locale for server-written copy, like errors and today's take).
- A 401 `{"error":"unauthorized"}` means: refresh the session once and retry; if it still fails, sign out.
- **`/api/v1/ask` is the one exception.** It re-exports `/api/ask`'s handler unchanged (`app/api/v1/ask/route.ts`),
  and that route predates this contract and answers signed-out callers in plain text, not JSON:
  - `POST /api/v1/ask` unauthenticated → `401` with body `Unauthorized` (a plain string, not `{"error":...}`).
  - `GET /api/v1/ask` unauthenticated → `401` with an **empty body**.
  Clients must branch on the **status code** for Ask, never parse its body as JSON to detect a 401. Every
  other endpoint below does return `{"error":"unauthorized"}` on 401.
- Everything not listed under the Server lane in the map below goes straight to Supabase with the same
  session (RLS applies).
- Send the same locale the person chose in the app's settings (the web app stores it in a cookie). Today's
  take is regenerated whenever the requested locale differs from the stored one, so a phone and a browser
  disagreeing on the language would regenerate it back and forth, one LLM call per switch.

## Endpoints

| Method + path | Body | Success | Errors |
| --- | --- | --- | --- |
| POST /api/v1/statements/parse | multipart: file (PDF ≤ 10 MB), account_id, password? | StatementPreviewResult (see `app/(app)/accounts/statement-actions.ts`) | 401 `{"error":"unauthorized"}`; 400 `{"error":"invalid_form"}` when the body isn't a form; otherwise 200 with `error` / `needsPassword` / `passwordIncorrect` in the body |
| POST /api/v1/statements/confirm | multipart: account_id, file_name, parsed_statement (echo from parse), mappings (JSON object sectionKey→accountId), exclude_from_budget? ("false" to include) | `{ importId, uncategorized }` | 401 `{"error":"unauthorized"}`; 400 `{"error":"invalid_form"}`; otherwise 200 with `error` in the body |
| POST /api/v1/recommendation | — | `{ refreshed: boolean }` — then read `daily_recommendations` directly | 401 `{"error":"unauthorized"}` |
| GET /api/v1/fx | — | `{ base, rates }` for the caller's profile base currency | 401 `{"error":"unauthorized"}` |
| POST /api/v1/ask | `{ messages: UIMessage[] }` (AI SDK v7 UI message stream) | stream | 401 plain text `Unauthorized` (see Authentication above); 400 plain text `Bad request`; 413 plain text `Question too large`; 429 plain text `Too many questions` |
| GET /api/v1/ask | — | 204 empty body (warm-up call — pays the cold-start cost before the person finishes typing) | 401 empty body; 429 empty body |

In-body `error` strings (statements/parse, statements/confirm) are translated prose meant for display —
they come straight from the underlying server action, in whatever locale `Accept-Language` selected.
Status codes are for control flow; don't pattern-match on error prose to decide what to do next.

**Rate limits**, both per signed-in user, enforced in-memory per server instance (`lib/rate-limit.ts`):
- Statement parsing: 10 per 10 minutes (`lib/statements/rate-limit.ts`). A refused parse is not a 429 —
  it's a normal 200 with the translated `llmRateLimited` string in `error`, same as any other parse failure.
- Ask: 20 per 5 minutes (`lib/ask/rate-limit.ts`). A refused Ask call **is** a 429, on both GET and POST
  (see the Endpoints row above).

## Server-action lane map

Three lanes:
- **server** — the action calls an LLM, calls `getExchangeRates` (a live market-rate lookup Postgres can't
  do on its own), computes a stored value the DB doesn't derive, or enforces an invariant that RLS and the
  table's own constraints don't already guarantee. These need a `/api/v1` endpoint before their screen can
  go native; most don't have one yet (see the Native path column).
- **direct** — a plain insert/update/delete/RPC (or read) whose validity RLS plus table constraints already
  guarantee. The native app calls Supabase directly with the signed-in session; no endpoint needed, ever.
- **auth** — replaced outright by a supabase-js Auth call on the device.

| Action | Lane | Why | Native path |
| --- | --- | --- | --- |
| `refreshRecommendation` (`app/(app)/actions.ts`) | server | Calls `inferRecommendation` (Gemini) to write `daily_recommendations`. | `POST /api/v1/recommendation` (done) |
| `createAccount` (`accounts/actions.ts`) | server | `resolveArtFor` calls `inferCardArt` (Gemini) for a new credit card with no accent colour. | endpoint added when its screen is nativized (Phase 3) |
| `updateAccount` (`accounts/actions.ts`) | server | Same `inferCardArt` call as `createAccount`, plus drops `current_balance` from the write once the card has statements (an anchored-balance invariant only this action checks — no DB constraint enforces it). | endpoint added when its screen is nativized (Phase 3) |
| `backfillCardArt` (`accounts/actions.ts`) | server | Loops `inferCardArt` (Gemini) over every card/group missing art. | endpoint added when its screen is nativized (Phase 3) |
| `archiveAccount` (`accounts/actions.ts`) | direct | Single `update` of `is_archived`; RLS scopes the row. | direct Supabase write |
| `deleteAccount` (`accounts/actions.ts`) | direct | Single `delete`; FK cascades own the rest. | direct Supabase write |
| `createBank` (`accounts/actions.ts`) | direct | De-dupe `select` then a single `insert`; no LLM, FX or security re-check. | direct Supabase write |
| `createCardWithLines` (`accounts/actions.ts`) | server | Calls `inferCardArt` (Gemini) once for the new card group's face. | endpoint added when its screen is nativized (Phase 3) |
| `createCardStub` (`accounts/actions.ts`) | server | Calls `inferCardArt` (Gemini) for the new stub card. | endpoint added when its screen is nativized (Phase 3) |
| `addCardLine` (`accounts/actions.ts`) | direct | No LLM call — inherits the sibling's already-stored `color`/`brand`. Multiple writes (group insert, link, line insert, rollback-on-failure) but each is RLS/FK-guaranteed and reproducible client-side. | direct Supabase writes |
| `setBudget` (`budgets/actions.ts`) | direct | Single `upsert`; zod only mirrors the month format and `amount >= 0`. | direct Supabase write |
| `createCategory` (`budgets/actions.ts`) | direct | `sort_order = last + 1` is a cosmetic ordering value (no unique constraint, no security stake); otherwise a single `insert`. | direct Supabase write |
| `updateCategory` (`budgets/actions.ts`) | direct | Single conditional `update`. | direct Supabase write |
| `deleteCategory` (`budgets/actions.ts`) | direct | Single `delete`. | direct Supabase write |
| `copyPreviousMonth` (`budgets/actions.ts`) | direct | Reads and rewrites only the caller's own RLS-scoped `category_budgets` rows; no external computation. | direct Supabase reads/writes |
| `categorizeTriageGroup` (`imports/actions.ts`) | server | Re-derives the transaction id set from the import server-side instead of trusting a client-supplied list, and validates that `categoryId` belongs to the caller (RLS scopes `transactions` by owner, but not which `category_id` a write may reference). The brief's canonical "re-derives targets for security" case. | endpoint added when its screen is nativized (Phase 3) |
| `createSubscription` (`recurring/actions.ts`) | direct | Single `insert`; brand inference is the separate `resolveSubscriptionBrand` call, not this one. | direct Supabase write |
| `updateSubscription` (`recurring/actions.ts`) | direct | Reads the old name to detect a rename and, if so, nulls the now-stale `color`/`logo_url`; no LLM/FX call itself. | direct Supabase read + write |
| `resolveSubscriptionBrand` (`recurring/actions.ts`) | server | Calls `inferBrand` (Gemini) for the subscription's colour/logo. | endpoint added when its screen is nativized (Phase 3) |
| `deleteSubscription` (`recurring/actions.ts`) | direct | Single `delete`. | direct Supabase write |
| `setSubscriptionActive` (`recurring/actions.ts`) | direct | Single `update`. | direct Supabase write |
| `addCharge` (`recurring/actions.ts`) | server | Calls `getExchangeRates` and computes `exchange_rate` via `resolveBaseRate` before inserting the transaction — a live market rate the DB cannot fetch itself. | endpoint added when its screen is nativized (Phase 3) |
| `updateBaseCurrency` (`settings/actions.ts`) | direct | Single `update`; the regex mirrors the column's 3-letter format. | direct Supabase write |
| `deleteAccount` (`settings/actions.ts`, the `delete_own_account` RPC) | direct | Single RPC call; the cascade through every user-owned table lives in Postgres (`supabase/migrations/20260720150000_delete_own_account.sql`). The trailing `auth.signOut()` is a plain client-side Auth call either way. | moved to Phase 2 (native Settings) — see the master plan |
| `updateDisplayName` (`settings/actions.ts`) | direct | Single `update`. | direct Supabase write |
| `setPayCycle` (`settings/actions.ts`) | direct | Validates the cycle enum and clamps `anchorDay` to the valid range, mirroring the `profiles_pay_anchor_day_valid` DB check constraint; single `update`. | direct Supabase write |
| `loadTransactions` (`transactions/actions.ts`) | direct | Read-only keyset-paginated query (`lib/transactions/queries.ts`) — filters, `.or()`, ordering and a `limit` a native client can issue directly against PostgREST; RLS scopes the rows. | direct Supabase read |
| `createTransaction` (`transactions/actions.ts`) | server | Calls `getExchangeRates` and computes `exchange_rate` via `resolveBaseRate`. The DB derives `base_amount`/`base_total_amount` from `amount * exchange_rate` in a trigger (`transactions_compute_amounts`, `supabase/migrations/20260717234227_transactions.sql`), but it has no way to fetch the market rate itself — that's the value this action supplies. | endpoint added when its screen is nativized (Phase 3) |
| `updateTransaction` (`transactions/actions.ts`) | server | Enforces two invariants no DB trigger covers: (1) a statement-sourced row may only have `category_id`/`notes`/`exclude_from_budget`/`budget_group_id` changed — nothing stops a direct `update` of its `amount`/`account_id`/date otherwise; (2) blocks moving a transaction onto an account of a different currency once its stored currency is already correct — the DB's `transactions_immutable_money` trigger only rejects an explicit change to the `currency`/`exchange_rate` columns, not an `account_id` change that produces the same mismatch. | endpoint added when its screen is nativized (Phase 3) |
| `deleteTransaction` (`transactions/actions.ts`) | server | Rejects deleting a statement-sourced row outright. No DB constraint blocks a direct `delete` of such a row (only deleting the whole statement cascades to it), so this guard exists purely in the action. | endpoint added when its screen is nativized (Phase 3) |
| `listImportTargets` (`accounts/statement-actions.ts`) | direct | Read-only, RLS-scoped. | direct Supabase reads |
| `listStubCurrencies` (`accounts/statement-actions.ts`) | direct | Read-only, RLS-scoped. | direct Supabase reads |
| `parseStatement` (`accounts/statement-actions.ts`) | server | Calls `extractWithLLM` (Gemini) via `extractAndParse`, plus PDF text extraction. | `POST /api/v1/statements/parse` (done) |
| `confirmStatementImport` (`accounts/statement-actions.ts`) | server | Calls `getExchangeRates` and computes each section's base-currency figures before calling the `import_card_statement` RPC. | `POST /api/v1/statements/confirm` (done) |
| `deleteCardStatement` (`accounts/statement-actions.ts`) | direct | Single `delete`; `card_statement_lines` → `transactions` cascade (`ON DELETE CASCADE`) handles the rest. | direct Supabase write |
| `saveMerchantRule` (`accounts/statement-actions.ts`) | server | Writes `category_rules.category_id`, and neither RLS (which only checks `category_rules.user_id`) nor the FK (`references public.categories (id)`, `supabase/migrations/20260722120000_statement_import.sql:128-149`) constrains that id to one the caller owns — the same gap `updateRule` closes by re-selecting the category first. Today's web action does not have that check either; a native endpoint for this must add it rather than writing straight to Supabase. | endpoint added when its screen is nativized (Phase 3) |
| `getStatementLineDetail` (`accounts/statement-actions.ts`) | direct | Read-only, RLS-scoped. | direct Supabase read |
| `createGoal` (`budgets/goal-actions.ts`) | direct | `sort_order = last + 1`, the same cosmetic-ordering case as `createCategory`. | direct Supabase write |
| `updateGoal` (`budgets/goal-actions.ts`) | direct | Single `update`. | direct Supabase write |
| `deleteGoal` (`budgets/goal-actions.ts`) | direct | Single `delete`; contributions cascade. | direct Supabase write |
| `deleteContribution` (`budgets/goal-actions.ts`) | direct | Single `delete`. | direct Supabase write |
| `addContribution` (`budgets/goal-actions.ts`) | direct | Its account-type/currency check mirrors the `goal_contributions_pin_account` DB trigger (`supabase/migrations/20260803120000_savings_goals.sql`), which already rejects `credit_card`/`loan` sources and pins `currency` from the account regardless of what's sent — the invariant is DB-guaranteed either way. | direct Supabase write |
| `createBudgetGroup` (`budgets/group-actions.ts`) | direct | `sort_order = last + 1`, same cosmetic-ordering case. | direct Supabase write |
| `updateBudgetGroup` (`budgets/group-actions.ts`) | direct | Single `update`. | direct Supabase write |
| `deleteBudgetGroup` (`budgets/group-actions.ts`) | direct | Single `delete`; `categories`/`transactions` FKs are `ON DELETE SET NULL`. | direct Supabase write |
| `setGroupBudget` (`budgets/group-actions.ts`) | direct | Single `upsert`. | direct Supabase write |
| `setCategoryGroup` (`budgets/group-actions.ts`) | direct | Single `update`. | direct Supabase write |
| `updateRule` (`settings/rules/actions.ts`) | server | Validates that `categoryId` belongs to the caller before writing it — RLS scopes `category_rules` by owner, but not which `category_id` a row may reference. Same re-derivation pattern as `categorizeTriageGroup`. | endpoint added when its screen is nativized (Phase 3) |
| `deleteRule` (`settings/rules/actions.ts`) | direct | Single `delete`. | direct Supabase write |
| `finishOnboarding` (`app/welcome/actions.ts`) | direct | The accounts-count guard protects only the caller's own onboarding flag — no cross-user or financial consequence if bypassed; reproducible client-side as a read then a write. | direct Supabase read + write |
| `setLocale` (`lib/i18n/actions.ts`) | direct | Not a Supabase call at all — it writes a locale cookie for server-rendered copy on web. Native has no equivalent action: the client keeps its own locale preference on-device and sends it as `Accept-Language` on every `/api/v1` call instead (see Authentication above). | no native equivalent — superseded by the `Accept-Language` header |
| `signIn` (`app/login/actions.ts`) | auth | `supabase.auth.signInWithPassword`. | `supabase.auth.signInWithPassword` on device |
| `signUp` (`app/login/actions.ts`) | auth | `supabase.auth.signUp`. | `supabase.auth.signUp` on device |
| `signInWithGoogle` (`app/login/actions.ts`) | auth | `supabase.auth.signInWithOAuth` (web redirect flow). | `supabase.auth.signInWithIdToken` with native Google sign-in |

## Compatibility rules

- Installed apps can't be force-updated: never change a v1 response shape in a breaking way. Add fields, or add /api/v2.
- DB changes the phone reads directly must be additive for one release cycle (see the master plan's risks).
