# Budget Groups — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the two dimensions the database now separates — the QUALIFIER (`categories`: what a transaction was) and the BUDGET GROUP (`budget_groups`: what a person plans against) — a UI, without changing what a user who never creates a group sees.

**Architecture:** The schema landed in `supabase/migrations/20260825140000_budget_groups.sql`. That file's header comments are the spec; read them before Task 1 rather than re-deriving the reasoning here. In short: `budget_groups` + `budget_group_budgets` are siblings of `categories` + `category_budgets`, `categories.budget_group_id` is the default rollup, `transactions.budget_group_id` is the per-transaction override, and `public.effective_budget_group(tx_group, cat_group)` resolves the two by `coalesce`. `q_budget_groups` is shaped exactly like `q_budgets`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase/Postgres with RLS, next-intl (en/es), Vitest, Tailwind + shadcn/ui, Recharts.

**Backend status:** Complete and merged as the migration above. `lib/ask/` already knows about groups — `guard.ts` allowlists `q_budget_groups`, `context.ts` reads group names into the prompt, `schema-doc.md` teaches the model the qualifier/group split. **No `/ask` work is in scope here.** This plan is UI only.

---

## Global Constraints

- **Locale parity is mandatory.** Every user-facing string gets a key in BOTH `messages/en.json` and `messages/es.json`. Spanish is the primary audience: write the Spanish first, then the English.
- **Money is `numeric` in Postgres and arrives as a string.** Always `Number(x ?? 0)` before arithmetic.
- **Server actions return `{ error?: string }`**, never throw, and route DB failures through `dbError(error, "actionName")` from `@/lib/errors`.
- **Never trust a client-supplied row id.** Actions derive rows from the scope they were given; RLS is the backstop, not the check.
- **Tests:** `npm test` (Vitest, globals enabled, `@` aliased to the repo root). Unit tests sit beside the file under test as `<name>.test.ts`.
- **Zero groups must be invisible.** A user with no rows in `budget_groups` must see the Budgets page exactly as it looks today — no empty band, no new heading, no "get started with groups" nag. Every task below is written so that the zero-group path is the unchanged path. This is the single most important constraint in the plan and it is worth a test of its own in Task 3.
- **The help guide is updated in the same change as any feature** (Task 9) — page, mocks, en + es.

---

## The adoption problem, and the shape that solves it

The temptation is a migration wizard: "pick a group for each of your categories." Reject it. Two reasons.

First, the existing budget system keeps working. `category_budgets`, `category_usage`, `q_budgets`, and the whole Budgets grid are untouched by the migration. A user who never opens the new UI loses nothing, so there is no deadline to force them past.

Second, groups only pay for themselves once a person has an opinion about *their* buckets, and that opinion does not exist on first sight of a wizard. The right entry point is one quiet affordance on the page they already use — an "Add group" button beside "Add category" — and a category dialog that grows one optional select. Someone who wants the feature finds it; someone who doesn't never learns it exists.

That means **the two systems run side by side, indefinitely and on purpose.** Do not add code that reconciles them, warns about them disagreeing, or nudges toward one. A category can have a budget and belong to a budgeted group at the same time; those are two answers to two different questions and neither is wrong.

---

### Task 0: The migration must be live first — HARD STOP

`lib/supabase/types.ts` on the `poc/budget-groups` branch is generated from a LOCAL stack. Until the migration is applied to the linked project, that file claims tables the remote does not have and any code you write against it compiles but 404s at runtime.

- [ ] **Step 1:** Confirm the migration is applied.
  ```bash
  ./node_modules/.bin/supabase migration list --linked
  ```
  `20260825140000` must show a value in the `remote` column. If it does not, **stop** — the human must run `./node_modules/.bin/supabase db push --linked`; the agent is blocked from it.

- [ ] **Step 2:** Regenerate types from the remote, not from local.
  ```bash
  ./node_modules/.bin/supabase gen types typescript --linked > lib/supabase/types.ts
  ```

- [ ] **Step 3:** `npx tsc --noEmit` clean, `npm test` green. Do not start Task 1 until both are.

---

### Task 1: `getBudgetGroupOverview`

The read side. Deliberately parallel to `getBudgetOverview` in the same file so the two are obviously siblings, and so a reader who knows one knows the other.

**Files:**
- Modify: `lib/budgets/queries.ts`
- Test: `lib/budgets/queries.test.ts` (exists; extend it)

**Interfaces:**
- Consumes: `q_budget_groups`, `budget_groups`.
- Produces:
  ```ts
  export type BudgetGroupRow = {
    budget_group_id: string;
    name: string;
    emoji: string | null;
    color: string | null;
    budget: number;
    used: number;
    remaining: number;
    status: BudgetStatus;   // reuse, do not redefine
  };
  export type BudgetGroupOverview = {
    rows: BudgetGroupRow[];
    totalBudget: number;
    totalUsed: number;
    baseCurrency: string;
  };
  export async function getBudgetGroupOverview(month: string): Promise<BudgetGroupOverview>;
  ```

- [ ] **Step 1: Write the failing tests**

  Three cases, and the first is the load-bearing one:
  1. No groups → `rows: []`, totals `0`. (The zero-group constraint, asserted at the data layer.)
  2. A group with a budget and spend → `used` and `remaining` come from `q_budget_groups`, not recomputed.
  3. A group with **no** budget row for the month → still appears, with `budget: 0` and `used` computed. `q_budget_groups` omits unbudgeted groups by design (it is `budget_group_budgets` LEFT JOINed outward), so this row can only come from the `budget_groups` list. Getting this wrong makes a group vanish the month you forget to budget it.

- [ ] **Step 2: Implement**

  Mirror `getBudgetOverview`'s shape: `Promise.all` over `budget_groups` (ordered by `sort_order`) and `q_budget_groups` filtered to the month, then left-join in JS keyed by `budget_group_id`. Derive `status` with the same thresholds `category_usage` uses — extract that rule into a shared helper if it is currently inline in SQL, rather than writing a second copy of the numbers.

- [ ] **Step 3:** `npm test lib/budgets` green.

---

### Task 2: Group server actions

**Files:**
- Create: `app/(app)/budgets/group-actions.ts` (a new file, not an addition to `actions.ts` — `goal-actions.ts` already establishes one-file-per-concern here)
- Test: colocated

**Interfaces:**
- `createBudgetGroup(input)` / `updateBudgetGroup(id, input)` — `{ name, emoji?, color? }`, zod-validated, same shape as `categorySchema`.
- `deleteBudgetGroup(id)` — relies on `on delete set null`; categories and transactions survive.
- `setGroupBudget(input)` — `{ budget_group_id, month, amount }`, upsert on `budget_group_id,month`.
- `setCategoryGroup(categoryId, groupId | null)` — the assignment, callable from the category dialog.

- [ ] **Step 1: Write failing tests** for the validation boundary and the null-clearing path on `setCategoryGroup` (passing `null` must clear, not no-op).
- [ ] **Step 2: Implement.** Copy `setBudget`'s structure verbatim including `revalidatePath("/budgets")` and `revalidatePath("/")`.
- [ ] **Step 3:** Tests green.

---

### Task 3: The Budgets page grows a second band

**Files:**
- Modify: `app/(app)/budgets/page.tsx`
- Create: `components/budgets/group-grid.tsx`
- Create: `components/budgets/group-dialog.tsx`

The page today is `BudgetGrid` → `Separator` → `GoalGrid`, each band rendering its own heading because they answer to different clocks. Groups are a third band with the same month clock as budgets, so it goes **above** `BudgetGrid`: the plan comes before its breakdown.

- [ ] **Step 1:** Fetch `getBudgetGroupOverview(month)` alongside the existing two in the page's `Promise.all`.

- [ ] **Step 2: `GroupGrid`.** **If `rows.length === 0`, return `null`.** Not an `EmptyState` — null. The band does not exist until the first group does. Write this as an explicit test.

  Otherwise it is `BudgetGrid`'s grid view: `ColorTile`, `MoneyDisplay`, `StatPill`, the same `STATUS_COLOR` map and `barPct`, the same `useMaskedFormatMoney`. Do not invent a second visual language for the same quantity. Skip the grid/table toggle — with five rows a table earns nothing.

- [ ] **Step 3: `GroupDialog`.** A near-copy of `CategoryDialog` (name / emoji / `SWATCHES` color). Resist generalising the two into one component: they diverge in Task 4 when the category dialog gains a field this one must not have.

- [ ] **Step 4: The entry point.** An "Add group" button in `BudgetGrid`'s existing heading toolbar, beside "Add category". This is the *only* affordance a zero-group user ever sees, so it has to sit where they already are.

- [ ] **Step 5:** Verify `npm test` and that the page renders unchanged for a user with no groups.

---

### Task 4: The category dialog gains a group select

**Files:**
- Modify: `components/budgets/category-dialog.tsx`, `app/(app)/budgets/actions.ts`, `lib/budgets/queries.ts`

- [ ] **Step 1:** `BudgetRow` gains `budget_group_id: string | null`; `getBudgetOverview` selects it.
- [ ] **Step 2:** The dialog takes a `groups: BudgetGroupRow[]` prop and renders a select **only when `groups.length > 0`**. Zero groups, zero new field.
- [ ] **Step 3:** Include `budget_group_id` in `createCategory` / `updateCategory`'s schema as `.uuid().nullable().optional()`. An empty select value is `null`, not `""` — `""` will fail the uuid cast and surface as a validation error the user cannot act on.
- [ ] **Step 4:** Tests for the null path.

---

### Task 5: The per-transaction override

**Files:**
- Modify: `components/transactions/transaction-form.tsx` and its action

This is the feature's whole reason for existing — the taxi that stays `Transport` for reporting and counts as `Lifestyle` in the plan — and it is also the easiest thing to get wrong by making it prominent. It is an override, used rarely.

- [ ] **Step 1:** Put it behind the form's existing advanced/collapsed section, next to `exclude_from_budget`. Never in the primary field flow.
- [ ] **Step 2:** Render only when the user has groups.
- [ ] **Step 3:** Label it for what it does, not what it is. Not "Budget group" — the category already implies one. Something closer to *"Count under a different group"* / *"Contar en otro grupo"*, with the category's inherited group shown as the placeholder so the default is visible and the override reads as a departure from it.
- [ ] **Step 4:** Writing `null` must mean "inherit from category", never "no group". `effective_budget_group` already guarantees this; the form must not send `""`.

---

### Task 6: Insights

**Files:**
- Modify: `components/insights/budget-bars.tsx` and its query

- [ ] **Step 1:** When the user has groups, `budget-bars` plots groups. When they do not, it plots categories exactly as today.
- [ ] **Step 2:** Do not render both. Two stacked charts of the same money sliced two ways is the exact confusion this whole change exists to remove.

---

### Task 7: Reordering

- [ ] `sort_order` exists on `budget_groups` and nothing writes it yet. Match however categories are reordered today; if categories have no reorder UI either, skip this task and leave `sort_order` at its default — do not build the first reorder affordance in the app for the newer of the two concepts.

---

### Task 8: Seeded demo data

`supabase/seeds/budget_groups_poc.sql` seeds user `4b6e8639-43c7-446c-b2de-6db62eddb6f1` with Essentials / Lifestyle / Future / Misc, category mappings, monthly budgets, and 7 demo transactions tagged `notes = '[poc:budget-groups]'` — one of which is the Transport→Lifestyle override.

- [ ] **Step 1:** Use it to eyeball the UI. Every row it creates carries that `notes` tag.
- [ ] **Step 2:** When done, `delete from public.transactions where notes = '[poc:budget-groups]'`. The groups and budgets can stay if they are wanted.

---

### Task 9: Help guide

- [ ] **Step 1:** `app/(app)/help/page.tsx` — a chapter explaining the split. Lead with the distinction, not the feature: a category says what something *was*, a group says what it *counts against*, and most people want three to six groups and as many categories as they like.
- [ ] **Step 2:** `components/help/mocks.tsx` — a mock for the group band.
- [ ] **Step 3:** `messages/en.json` + `messages/es.json`, Spanish first.

---

## Verification before calling this done

```bash
npx tsc --noEmit
./node_modules/.bin/eslint .
npm test
npx next build
```

Then, in the browser, both paths — because only one of them is likely to have been exercised during development:

1. **A user with no groups.** Budgets, Insights, and the transaction form are byte-for-byte what they were. This is the regression that matters; everything else is additive.
2. **The seeded user.** Groups band shows four rows; group totals reconcile against a `GROUP BY budget_group` on `q_transactions`; the overridden Uber shows as `Transport` on the transactions list and inside Lifestyle on the plan.

---

## Reference

- Schema + reasoning: `supabase/migrations/20260825140000_budget_groups.sql`
- Model-facing docs: `lib/ask/schema-doc.md` § "Two different questions: what it WAS, and what it was FOR"
- Demo data: `supabase/seeds/budget_groups_poc.sql`
