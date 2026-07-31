# Welcome Bonus Spend Progress — Design

**Date:** 2026-07-31
**Status:** Approved direction, pending spec review

## 0. Background

Many credit cards offer a signup/welcome bonus if you spend a target amount within a
window after opening the card. This feature lets a user record that goal (amount + due
date) on a credit-card account and see a progress bar on the card's detail page tracking
how much they've spent toward it.

A physical card can be split into multiple `accounts` rows sharing one `card_groups.id`
(e.g. a DOP line and a USD line of the same card — see `card_group_id` on `accounts`,
`supabase/migrations/20260717234225_accounts.sql`). The welcome bonus is a property of the
physical card, not of one currency line, so:

- Spend counts every expense on every line in the group (all currencies, converted into
  one goal currency).
- The goal can be entered on any line's edit form and is then visible/editable from every
  sibling line — the same account can't be edited twice with two different goals in
  practice, but if it ever is, the value most recently saved wins everywhere (see §2).
- The window has no explicit start date — the user confirmed spend should be summed over
  the card's entire transaction history up to the due date (cards are added to the app
  right when opened, so "since the card existed" and "since the bonus period began" are
  the same moment for their use case). Only two inputs exist on the form: goal amount and
  due date.

## 1. Data model

Three new nullable columns on `accounts`, meaningful only for `type = 'credit_card'`:

```sql
alter table public.accounts
  add column welcome_bonus_goal_amount   numeric(18,4),
  add column welcome_bonus_goal_currency text check (char_length(welcome_bonus_goal_currency) = 3),
  add column welcome_bonus_due_date      date;
```

No DB-level constraint tying the three together or to `type = 'credit_card'` — mirrors
`credit_limit`/`statement_closing_day`/`payment_due_day`, whose "required together, credit
cards only" rule lives in `accountInput`'s `superRefine` (`lib/accounts/schema.ts`), not
the schema. Same approach here: all-three-or-none, enforced in the zod schema.

## 2. Reading the "effective" goal across a card group

No fan-out writes, no new `card_groups` columns, no new group-edit UI. Each account row
stores its own values (or nulls); a small resolver decides what to show for a given
account:

`lib/accounts/welcome-bonus.ts` — new file, pure function:

```ts
type BonusFields = {
  id: string;
  welcome_bonus_goal_amount: number | null;
  welcome_bonus_goal_currency: string | null;
  welcome_bonus_due_date: string | null;
  updated_at: string;
};

/** The goal to show for `accountId`: its own value if set, otherwise the
 *  most-recently-updated non-null value among its card_group siblings. */
export function resolveEffectiveBonus(accountId: string, group: BonusFields[]): BonusFields | null {
  const mine = group.find((a) => a.id === accountId);
  if (mine?.welcome_bonus_goal_amount != null && mine.welcome_bonus_due_date != null) return mine;
  const withGoal = group
    .filter((a) => a.welcome_bonus_goal_amount != null && a.welcome_bonus_due_date != null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return withGoal[0] ?? null;
}
```

The account detail page needs "this account + its card_group siblings" to compute both
the resolved goal (§4/§5) and the group-wide spend (§3) — a new query,
`getCardGroupSiblings(accountId)` in `lib/accounts/queries.ts`, returns all `accounts` rows
sharing the current account's `card_group_id` (or just the account itself when
`card_group_id` is null), selecting `id, currency, welcome_bonus_goal_amount,
welcome_bonus_goal_currency, welcome_bonus_due_date, updated_at`. Two-step query (fetch the
account first for its `card_group_id`, then fetch the group) — same shape as
`loadAccountContext` in `app/(app)/accounts/statement-actions.ts`, the existing precedent
for "look up my card_group siblings." This one query result is reused for both the
progress bar (§4) and the edit dialog's prefill (§5) — the detail page is the only caller
of either.

**Why resolve at read time instead of fan-out on write:** it needs no extra write-path
logic, and group membership changes (an account joining/leaving a group) are handled for
free — the resolver just includes whatever siblings exist *now*. The tradeoff (two rows in
the same group could technically hold different non-null values) is accepted per user
direction; last-updated wins, and in the only real workflow — setting the goal once, on
whichever line the user opens first — this never actually happens.

## 3. Spend calculation

New function in `lib/accounts/welcome-bonus.ts`:

```ts
export async function getWelcomeBonusSpend(
  supabase: SupabaseClient,
  accountIds: string[],
  goalCurrency: string,
  dueDate: string,
): Promise<number>
```

- Queries `transactions` where `type = 'expense'`, `account_id in (accountIds)`,
  `occurred_at <= dueDate` — no lower bound, and no `budget_only`/`exclude_from_budget`
  filter (per direction: "all expenses count toward the goal").
- Selects `account_id, total_amount`. Each row is in its own account's currency (a
  transaction is always denominated in its owning account's currency — see the comment in
  `lib/transactions/schema.ts`), so build an `accountId -> currency` map from the sibling
  rows already fetched in §2, then convert each transaction with `crossRate(fromCurrency,
  goalCurrency, rates)` (`lib/fx.ts`) and sum. `rates` comes from one
  `getExchangeRates(goalCurrency)` call per page render.
- Uses **today's live rate** for every transaction regardless of when it occurred — same
  approximation `lib/fx.ts` already makes for net worth/point-in-time balances. This is a
  deliberate simplification flagged here rather than trying to reconstruct a historical
  cross rate per transaction; called out again in §7.
- When `fromCurrency === goalCurrency`, `crossRate` returns `1` and the amount passes
  through unconverted — the common case (most lines share the goal's currency) never
  touches the FX table at all.

## 4. Detail page (`app/(app)/accounts/[id]/page.tsx`)

- Alongside the existing `getCardStatements(id)` fetch, add `getCardGroupSiblings(id)`,
  then `resolveEffectiveBonus` and (only if a goal resolves) `getWelcomeBonusSpend`.
- Show the bar only when the effective goal has both `welcome_bonus_goal_amount` and
  `welcome_bonus_due_date` set **and** `due_date >= today` (UTC date compare, same
  no-timezone-drift approach as `formatDate`).
- Rendered in the hero `Card`, directly below the existing utilization bar (inside the
  `isCardType` branch), same `max-w-sm space-y-2` / label-row / `Progress` idiom:

```tsx
{bonus ? (
  <div className="mt-4 max-w-sm space-y-2">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{t("welcomeBonusProgress")}</span>
      <span>{formatPercent(bonusPct)}</span>
    </div>
    <Progress value={Math.min(Math.max(bonusPct, 0), 100)} />
    <p className="text-xs text-muted-foreground">
      {t("welcomeBonusDetail", {
        spent: formatMoney(bonusSpent, bonus.welcome_bonus_goal_currency),
        goal: formatMoney(bonus.welcome_bonus_goal_amount, bonus.welcome_bonus_goal_currency),
        date: formatDate(bonus.welcome_bonus_due_date, locale),
      })}
    </p>
  </div>
) : null}
```

`bonusPct = (bonusSpent / bonus.welcome_bonus_goal_amount) * 100` — uncapped in the label
(can show >100% once the goal is cleared, matching how `util`'s real percentage is shown
while the bar itself clamps), capped only for the bar's `value`.

## 5. Form UI (`components/accounts/account-form-dialog.tsx`)

The three fields stay tucked away behind a single checkbox so the common case (no bonus to
track) doesn't add visible clutter to the credit-card fields grid — same idea as the
`network_fee_optional` `Switch`, but gating visibility of a whole sub-block rather than
toggling one boolean column.

New local (non-submitted) form state, `has_welcome_bonus_goal: boolean`, defaulting to
`true` when the effective resolved value (§2) has a goal set, `false` otherwise — not part
of `AccountInput`/`accountInput`, exactly like `newGroupName`/`newBankName` are local
`useState` rather than registered fields. Rendered as a `Switch` + label, e.g. "Track a
welcome bonus goal", directly under `card_group_id`'s block. Only when checked does the
sub-block render:

- **Welcome bonus goal amount** — `Input type="number" step="0.01" min="0"`, required
  while the switch is on.
- **Welcome bonus goal currency** — `Select`, same `currencyItems`/pattern as the existing
  currency selector, defaulting to `baseCurrency` on create.
- **Welcome bonus due date** — `Input type="date"`, required while the switch is on.

`onSubmit` sends all three fields as `undefined` when `has_welcome_bonus_goal` is false —
same normalization already applied to empty strings (`v === "" ? undefined : v"`, line
~200) — so unchecking and saving clears a previously-set goal (all three go to `null` via
`toColumns`'s existing `nullIf` handling, §6), and the `superRefine` all-or-none rule (§1)
only ever needs to fire while the switch is on.

`defaultsFor` prefills the three fields (and the switch) from the **effective resolved
value** (§2), not the raw account row — so opening the edit form on any sibling line shows
the goal that's already configured for the card, switch on, letting the user confirm,
change, or clear it. `AccountFormDialog` gains a new optional prop, `effectiveBonus:
BonusFields | null`, used only by `defaultsFor` as the prefill source (falling back to the
raw `account` fields when absent — the create-mode case below).

The only place `AccountFormDialog` is rendered in **edit** mode is `AccountDetailActions`
(`components/accounts/account-detail-actions.tsx`), used solely by the account detail page
— confirmed no edit entry point exists on the accounts list/gallery page (its two
`AccountFormDialog` usages in `account-gallery.tsx` are both `mode="create"`). So only the
detail page needs to compute `effectiveBonus` (already doing so for §4) and pass it through
`AccountDetailActions` down to the dialog. **Create mode** (new account, possibly assigned
to an existing group via the `card_group_id` dropdown) is left without a prefill — the new
line's own goal fields simply start blank; the group's existing goal still resolves and
displays correctly once saved, per §2, without requiring the user to re-enter it.

Saving always writes to the edited account's own row (`toColumns`/`updateAccount` — no
fan-out), consistent with §2.

## 6. Schema & server actions

- `lib/accounts/schema.ts`: add `welcome_bonus_goal_amount`, `welcome_bonus_goal_currency`,
  `welcome_bonus_due_date` (all optional) to `accountInput`; `superRefine` requires all
  three together when any one is present, for `type === "credit_card"` only (silently
  dropped/nulled for other types, matching `credit_limit` etc.).
- `app/(app)/accounts/actions.ts`, `toColumns()`: add the three fields, `nullIf(!card, ...)`
  guarded like the other credit-card-only columns.

## 7. i18n

Add to `messages/en.json` and `messages/es.json`:

- `AccountForm.welcomeBonusGoalAmountLabel`, `welcomeBonusGoalCurrencyLabel`,
  `welcomeBonusDueDateLabel`, and a short hint string explaining the shared-across-lines
  behavior (mirrors `AccountForm.groupHint`).
- `AccountDetail.welcomeBonusProgress`, `welcomeBonusDetail` (interpolated: spent / goal /
  date).

## 8. Types

No live Supabase project linked in this environment (confirmed absent in the prior
`exclude_from_budget` spec and still true) — hand-edit `lib/supabase/types.ts`'s `accounts`
Row/Insert/Update to add the three new nullable columns, mirroring `credit_limit`'s
optional-on-Insert/Update shape. Flag to the user as something to double check next time
`supabase gen types` runs against the real project.

## 9. Testing

No SQL test harness in this repo (confirmed in the prior spec). Verification: `tsc
--noEmit`, `npm run lint`, plus unit tests for the two pure helpers in
`lib/accounts/welcome-bonus.ts` (`resolveEffectiveBonus`'s own-value-wins /
sibling-fallback / none-set cases; the FX conversion + summing math), following the
existing `card-due.test.ts` pattern (pure functions, no Supabase mocking needed for the
resolver — the spend function needs a lightweight Supabase stub, or is manually verified
instead if the codebase has no existing precedent for mocking `supabase.from(...)`).
Manual walkthrough: set a goal on one line of a two-line group, confirm the other line's
edit form and detail-page bar both reflect it immediately; log expenses on both lines in
different currencies and confirm the summed/converted total matches; set a due date in the
past and confirm the bar disappears.

## 10. Out of scope

- Historical FX accuracy (§3's live-rate approximation is accepted, not solved).
- Any UI on `card_groups` itself — no group-level edit form is introduced.
- Multiple concurrent goals per card (e.g. re-running a new bonus after the first is
  claimed) — setting a new goal simply overwrites the old one; no history is kept.
- Notifications/reminders as the due date approaches.
