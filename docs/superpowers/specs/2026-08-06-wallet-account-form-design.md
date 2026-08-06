# Wallet Rename, Add-Account Restructure, Form Validation — Design

**Date:** 2026-08-06
**Status:** Approved direction, pending spec review

## 0. Background

Three related pieces of account-UX cleanup:

1. The "Accounts" tab/page is renamed "Wallet".
2. The "Add account" flow currently opens a dialog whose first decision (account type) is
   just another field inside a long form. Picking the type up front — as the entry point
   itself — lets the type field be removed from the form body entirely, shrinking it and
   removing a class of "wrong type picked, rest of form doesn't make sense" error.
3. Several fields across the app's forms are effectively required (by the server-side zod
   schema, or by business logic) but give no visual cue and no client-side validation. Because
   `Select` fields are wired through React Hook Form's `Controller`, they carry no native
   `required` semantics — nothing stops an empty one from being submitted. Today's only error
   signal is a single generic `toast.error(result.error)` from the server, which doesn't say
   which field is wrong. This shows up worst on the account form (25+ fields, several
   conditionally required) but the same gap exists on the transaction, subscription, and
   goal-contribution forms.

## 1. Wallet rename

- `messages/en.json` / `messages/es.json`: `Nav.accounts` "Accounts"/"Cuentas" → "Wallet"/
  (es equivalent, e.g. "Billetera").
- `Accounts.pageTitle` "Accounts"/"Cuentas" → "Wallet"/(es equivalent).
- Everything else in the `Accounts` namespace (group titles, empty states, descriptions)
  is unchanged — those describe sub-sections of the page, not the tab/page itself.
- No route changes: `/accounts` stays as the path (only user-facing copy changes).

## 2. Add-account: select-as-trigger, type removed from the form

### Trigger

`components/accounts/account-gallery.tsx` currently renders a `Button` ("Add account" /
"Add your first account") that wraps `AccountFormDialog` via its `trigger` prop
(`DialogTrigger`). Both call sites change to a `Select`:

- Placeholder/closed state reads as "Add account" (translated), with a leading `Plus` icon,
  styled with `buttonVariants({ variant: "default" })` so it keeps the same primary-CTA
  visual weight as today's button (chevron replaces nothing — it's additive, signaling
  "opens a list").
- Options are `CREATABLE_TYPES` from `lib/accounts/meta.ts`, each rendered as
  `<Icon className="size-4" />{tType(type)}`, using the icon already defined per type in
  `ACCOUNT_TYPE_META` — no new icon mapping needed.
- `onValueChange` sets local state (`pendingType`) and that drives `AccountFormDialog`'s
  `open` prop — selecting a type is what opens the dialog.
- Empty-state ("Add your first account") gets the same treatment: same `Select`, just
  placed inside `EmptyState`'s `action` slot instead of the button.

### `AccountFormDialog` API change

- New optional props: `initialType?: AccountType`, `open?: boolean`,
  `onOpenChange?: (open: boolean) => void`.
- `trigger` becomes optional. Two mutually exclusive modes:
  - **`trigger` passed** (edit mode via `account-detail-actions.tsx`'s pencil button):
    unchanged — internal `open` state, `DialogTrigger` wraps `trigger`.
  - **`trigger` omitted** (the new create flow): no `DialogTrigger` rendered; `open`/
    `onOpenChange` are fully controlled by the parent (`AccountGallery`). Closing the dialog
    (via its own Cancel/X or a successful submit) calls `onOpenChange(false)`, which the
    parent uses to reset `pendingType` back to `null`.
- `defaultsFor()` seeds `type` from `initialType` when present (create mode), falling back to
  `"checking"` as today for edit mode / no initial type.

### Form body

- The `Type` `Select`/`Controller` block is deleted from the form entirely — for **both**
  create and edit. Per your direction, type becomes fixed after creation: editing an
  existing account no longer offers a way to change its type.
- `type` still flows through `FormValues` and `onSubmit` exactly as today (it's just no
  longer user-editable inside the dialog) — created from `initialType` on create, and from
  `account.type` (read-only, never rendered as a field) on edit.
- Everything conditioned on `card` / `loan` (credit-card fields, loan fields, transfer-fee
  section) is unchanged — those still branch on the `type` value, just one that arrived
  pre-selected instead of picked mid-form.

## 3. Required indicators + real error messaging (app-wide)

### Shared pieces (new)

- `components/ui/label.tsx`: `Label` gains a `required?: boolean` prop. When true, renders
  `<span className="text-destructive" aria-hidden="true"> *</span>` after the label's
  children.
- `components/ui/field-error.tsx` (new): `FieldError({ message }: { message?: string })` —
  renders `<p className="text-xs text-destructive">{message}</p>` when `message` is set,
  otherwise `null`. Used under every field driven by RHF validation.
- One shared caption per dialog/form, near the submit button:
  `<p className="text-xs text-muted-foreground">{tc("requiredFieldsHint")}</p>` — new
  `Common.requiredFieldsHint` key, e.g. "* Required" / es equivalent. Explains the asterisk
  convention once per form rather than repeating it per field.

### Per-form wiring

All four forms below switch `useForm` to
`useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: ... })`, using each
form's existing (or newly extracted) zod schema as the single source of truth for both
required-ness and error copy. Every `Input`/`Select` gets `aria-invalid={!!fieldState.error}`
(the red border/ring already exists in `Input`/`Select`'s CSS via `aria-invalid:*` classes —
today nothing ever sets the attribute, so it's dead code coming alive, not new styling) plus a
`<FieldError message={fieldState.error?.message} />` directly beneath it. For plain
`register()`-only fields (no `Controller`), the equivalent is
`formState.errors.<field>?.message` since there's no per-field `fieldState` without
`Controller`/`useController`.

**`account-form-dialog.tsx`** (`lib/accounts/schema.ts` → `accountInput`):
- Required, always: `name`.
- Required when `card` (credit card): `credit_limit`, `statement_closing_day`,
  `payment_due_day`.
- Required when `loan`: `principal`, `term_months`, `installment_amount`.
- Required, only when the welcome-bonus `Switch` is on (all three together, already the only
  case they render): `welcome_bonus_goal_amount`, `welcome_bonus_goal_currency`,
  `welcome_bonus_due_date`.
- `bank_id`, `card_group_id`, `color`, `original_term_months`, transfer-fee fields stay
  optional — no asterisk.
- The `Type` field's removal (§2) means one less thing to validate here.

**`transaction-form.tsx`** (`lib/transactions/schema.ts` → `transactionInput`):
- Required, always: `account_id` ("Pick an account" — currently only guaranteed non-empty by
  a JS default that can end up `""` if `accounts` is empty, which is already guarded by the
  early-return "no accounts" message above the form), `amount`, `occurred_at`.
- Required when `type === "expense"`: `category_id` ("Pick a category").
- Required when `type === "payment"`: `to_account_id` ("Pick a destination account"),
  `transfer_rate` when `crossCurrency` (already has an ad hoc toast-based check in
  `onSubmit` today — that check is removed in favor of the schema catching it, since
  `to_amount`/`transfer_rate` cross-field logic already lives in `transactionInput`'s
  `superRefine`... note: `transfer_rate` itself isn't currently a schema field — it's
  UI-only, converted to `to_amount` before submit. Its required-when-cross-currency rule
  stays as today's inline check in `onSubmit`, but gains a `FieldError` under the rate input
  instead of only a toast, and its `Label` gets the `required` marker — it's only ever
  rendered when `crossCurrency` is true, at which point it's mandatory, same reasoning as
  the credit-card/loan conditional fields above).

**`subscription-form-dialog.tsx`** (`lib/subscriptions/schema.ts` → `subscriptionInput`):
- Required, always: `name`, `amount`, `currency`, `billing_cycle`.
- `brand`, `anchor_day`, `account_id`, `category_id` stay optional (all have `"none"`/empty
  sentinels today) — no asterisk.

**`goals/contribute-dialog.tsx`**: no shared schema exists today — `contributionSchema` is
declared inline and unexported inside `app/(app)/budgets/goal-actions.ts` (a `"use server"`
file, which per Next.js can only export async functions, so it can't be imported by the
client as-is). Extract it to a new `lib/goals/schema.ts`:

```ts
import { z } from "zod";

export const contributionInput = z.object({
  goal_id: z.string().uuid(),
  account_id: z.string().uuid("Pick an account"),
  amount: z.coerce.number().refine((n) => n !== 0, "Enter an amount"),
  exchange_rate: z.coerce.number().positive().default(1),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export type ContributionInput = z.infer<typeof contributionInput>;
```

`goal-actions.ts` imports `contributionInput` from there instead of declaring it inline (drop
the local `contributionSchema` const and its now-unused `z` usage if nothing else in that
file needs it directly). `contribute-dialog.tsx` switches its ad hoc `useState`-driven
`account_id` and manual `onSubmit` toast checks (`pickAccount`, `amountRequired`) to
`Controller` + `resolver: zodResolver(contributionInput)`, matching the other three forms.
Required: `account_id`, `amount`, `occurred_at` (all always visible, get the `Label` `required`
marker unconditionally). `exchange_rate` required only when `crossCurrency` — its field is
already only rendered in that case, so it gets the marker too, enforced the same way as
`transfer_rate` above (inline check + `FieldError`, since the required-ness is conditional on
form state rather than expressible as an unconditional schema field).

### What stays unchanged

- Server-side `zod` parsing in every action, and the `dbError`/`toast.error(result.error)`
  fallback path, are untouched — they remain the backstop for errors the client can't
  anticipate (uniqueness violations, auth, DB constraints). The `Result = { error?: string }`
  action contract is not changed to carry a field path; that would require touching every
  action's return shape for a case client-side validation now makes rare.
- No RHF auto-focus/scroll-to-error behavior is added. Given each form is a single-column (or
  two-column) vertical layout inside a scrollable dialog, the inline red `FieldError` text and
  the reddened `Select`/`Input` border are enough to locate the problem without extra
  scroll-management code.

## 4. i18n

Add to `messages/en.json` and `messages/es.json`:

- `Nav.accounts`, `Accounts.pageTitle` → "Wallet" (update existing values, not new keys).
- `Common.requiredFieldsHint` (new).
- No new key for the select's closed-state CTA text — reuse the existing
  `Accounts.addAccount` / `Accounts.addFirstAccount` values directly as its placeholder at
  each of the two call sites, same as today's button text.
- Any newly-needed field-level messages that don't already exist verbatim in the zod schemas
  (most already have good messages, e.g. `transactionInput`'s "Pick an account" — these are
  hardcoded English strings inside the schema today, not run through `next-intl`, so they'll
  render in English regardless of locale; **out of scope** to localize schema messages in this
  pass — see §5).

## 5. Out of scope

- Localizing the error messages that live inside zod schemas (`accountInput`,
  `transactionInput`, `subscriptionInput`, the new `contributionInput`) — they're plain
  hardcoded English strings today and stay that way; only the new UI chrome (required
  asterisks, the "* Required" caption, select placeholders) is localized via `next-intl` as
  usual. Fixing this would mean threading a translation function into schema construction,
  a bigger refactor than this pass warrants.
- Changing the server action `Result` type to carry a field path for server-side errors.
- Extending the required-indicator/validation pattern to `settings-panel.tsx` — its controls
  are single-field, apply-immediately (no multi-field submit with a required-but-empty
  gap), so it doesn't have the bug this work fixes.
- Any change to what's actually required by the database/server (all required-ness here
  mirrors existing schema/business rules — no new constraints are introduced).
