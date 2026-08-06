# Wallet Rename, Add-Account Restructure, Form Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Accounts tab/page to "Wallet", turn the account-creation entry point into
a type-picker `Select` (icon + label per account type) that removes the `Type` field from the
form entirely, and add real required-field indicators and inline error messaging across the
account, transaction, subscription, and goal-contribution forms.

**Architecture:** No new dependencies — `@hookform/resolvers` is already installed but unused
(`zodResolver` isn't wired into any form yet). Each form switches from unvalidated
`useForm()` to `useForm({ resolver: zodResolver(schema) })` against the zod schema that
already backs its server action, giving real per-field required-ness and error copy for
free. Two small shared UI primitives (`Label`'s new `required` prop, a new `FieldError`
component) give every form the same visual language. The account form's create entry point
moves from a plain button to a `Select` that both picks the type and opens the (now
type-less) dialog.

**Tech Stack:** Next.js App Router, react-hook-form, `@hookform/resolvers/zod`, zod,
next-intl, Base UI (`@base-ui/react`) via the `components/ui/*` primitives, vitest.

**Spec:** `docs/superpowers/specs/2026-08-06-wallet-account-form-design.md`

## Global Constraints

- Every schema-required field gets the `Label` `required` marker (a `*`), whether or not a
  default value already prevents a blank submission today — see spec §3 and the design doc's
  "Clarify required-marker rule" commit. Optional fields never get the marker.
- Server-side zod parsing and the `dbError`/`toast.error(result.error)` fallback path in every
  action are untouched — client-side validation is additive, not a replacement for the
  server-side check.
- No new test infrastructure: this repo has no component-render test harness (no jsdom, no
  `@testing-library`; `vitest.config.ts` runs in Node). Automated tests apply only to pure
  logic (zod schemas). UI-only changes are verified with `tsc --noEmit`, `eslint`, and manual
  browser walkthroughs, matching every other plan in `docs/superpowers/plans/`.
- `lib/select-items.test.ts` statically enforces that every `<Select>` root rendering a
  `<SelectValue>` declares an `items=` prop (a value→label map for the closed trigger). Any
  new `<Select>` in this plan must include one or that test fails.
- Ask before starting or killing the dev server (project convention — see Task 8).

---

### Task 1: Wallet rename (i18n only)

**Files:**
- Modify: `messages/en.json` (lines 4, 112, 730)
- Modify: `messages/es.json` (lines 4, 112, 730 — line-for-line mirror of en.json)

**Interfaces:** none — pure copy, no code consumes these differently.

- [ ] **Step 1: Rename in `messages/en.json`**

Line 4, inside `Nav`:
```json
    "accounts": "Accounts",
```
→
```json
    "accounts": "Wallet",
```

Line 112, inside `Accounts`:
```json
    "pageTitle": "Accounts",
```
→
```json
    "pageTitle": "Wallet",
```

Line 730, inside `Help` (the in-app help guide's Accounts section heading — kept in sync per
this repo's convention of updating the help guide alongside the feature it documents):
```json
    "accountsTitle": "Accounts",
```
→
```json
    "accountsTitle": "Wallet",
```

Every other key containing "Accounts" (`Accounts.groupCashTitle`, `Help.commonFieldsTitle`,
etc.) is untouched — those describe sub-sections, not the tab/page itself.

- [ ] **Step 2: Rename in `messages/es.json`**

Line 4, inside `Nav`:
```json
    "accounts": "Cuentas",
```
→
```json
    "accounts": "Billetera",
```

Line 112, inside `Accounts`:
```json
    "pageTitle": "Cuentas",
```
→
```json
    "pageTitle": "Billetera",
```

Line 730, inside `Help`:
```json
    "accountsTitle": "Cuentas",
```
→
```json
    "accountsTitle": "Billetera",
```

- [ ] **Step 3: Verify JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"`
Expected: no output (no parse errors).

- [ ] **Step 4: Verify the app still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "rename Accounts tab and page to Wallet"
```

---

### Task 2: Shared validation UI primitives

**Files:**
- Modify: `components/ui/label.tsx`
- Create: `components/ui/field-error.tsx`
- Modify: `messages/en.json` (`Common` section, line 623)
- Modify: `messages/es.json` (`Common` section, line 623)

**Interfaces:**
- Produces: `Label`'s new `required?: boolean` prop (renders a trailing `*`); `FieldError({
  message?: string })` (renders `null` when `message` is falsy, otherwise a small red line of
  text). Both consumed by every task from Task 4 onward.

- [ ] **Step 1: Add `required` to `Label`**

Replace the full contents of `components/ui/label.tsx`:

```tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  )
}

export { Label }
```

- [ ] **Step 2: Create `FieldError`**

```tsx
// components/ui/field-error.tsx
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
```

- [ ] **Step 3: Add the shared "required fields" caption string**

In `messages/en.json`, `Common` object (after `"statementRowLocked"`, currently the last key
before the closing `},` at line 623):

```json
    "statementRowLocked": "This transaction comes from an imported statement. Delete the statement to remove it.",
    "requiredFieldsHint": "* Required"
```

In `messages/es.json`, same spot:

```json
    "statementRowLocked": "Esta transacción proviene de un estado de cuenta importado. Elimina el estado de cuenta para quitarla.",
    "requiredFieldsHint": "* Obligatorio"
```

- [ ] **Step 4: Verify**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"`
Expected: no output.

Run: `npx tsc --noEmit && npx eslint components/ui/label.tsx components/ui/field-error.tsx`
Expected: no errors. (`required` is optional, so every existing `<Label>` call site
still compiles unchanged.)

- [ ] **Step 5: Commit**

```bash
git add components/ui/label.tsx components/ui/field-error.tsx messages/en.json messages/es.json
git commit -m "add required-field marker to Label and a shared FieldError component"
```

---

### Task 3: Add-account entry point — type-picker select, type removed from the form

This is the biggest structural task: the "Add account" button becomes a type-picker
`Select`, and `AccountFormDialog` drops its `Type` field (in both create and edit) in favor
of a `type` that arrives pre-set — from the picker on create, fixed at `account.type` on
edit.

**Files:**
- Modify: `components/accounts/account-form-dialog.tsx`
- Modify: `components/accounts/account-gallery.tsx`

**Interfaces:**
- Produces: `AccountFormDialog` gains `initialType?: AccountType`, `open?: boolean`,
  `onOpenChange?: (open: boolean) => void`; `trigger` becomes optional
  (`trigger?: React.ReactNode`). When `trigger` is passed, behavior is unchanged (internal
  open state + `DialogTrigger`). When `trigger` is omitted, `open`/`onOpenChange` fully
  control the dialog.
- Consumes (from Task 2): none yet — validation wiring is Task 4.

- [ ] **Step 1: `AccountFormDialog` — imports**

In `components/accounts/account-form-dialog.tsx`, remove the now-unused `CREATABLE_TYPES`
import (the type picker moves to `account-gallery.tsx`) and add `useEffect`:

Replace:
```tsx
import { useState, useTransition } from "react";
```
with:
```tsx
import { useEffect, useState, useTransition } from "react";
```

Replace:
```tsx
import {
  CREATABLE_TYPES,
  isCard,
  isLoan,
  hasTransferFees,
  type AccountType,
} from "@/lib/accounts/meta";
```
with:
```tsx
import {
  isCard,
  isLoan,
  hasTransferFees,
  type AccountType,
} from "@/lib/accounts/meta";
```

- [ ] **Step 2: `defaultsFor` takes an `initialType`**

Replace:
```tsx
function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
): FormValues {
```
with:
```tsx
function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
  initialType: AccountType | undefined,
): FormValues {
```

Replace:
```tsx
    type: (account?.type as AccountType) ?? "checking",
```
with:
```tsx
    type: (account?.type as AccountType) ?? initialType ?? "checking",
```

- [ ] **Step 3: Component props and open-state control**

Replace the function signature and its prop type:
```tsx
export function AccountFormDialog({
  mode,
  account,
  currencies,
  cardGroups,
  banks,
  baseCurrency = "USD",
  effectiveBonus,
  trigger,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency?: string;
  effectiveBonus?: CardGroupSibling | null;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
```
with:
```tsx
export function AccountFormDialog({
  mode,
  account,
  currencies,
  cardGroups,
  banks,
  baseCurrency = "USD",
  effectiveBonus,
  trigger,
  initialType,
  open: controlledOpen,
  onOpenChange: onOpenChangeProp,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency?: string;
  effectiveBonus?: CardGroupSibling | null;
  /** Omit to run in controlled mode via `open`/`onOpenChange` instead (the create flow's
   *  type-picker select opens this dialog itself — see AccountGallery). */
  trigger?: React.ReactNode;
  /** Seeds `type` on create. Never user-editable inside the dialog — see spec §2. */
  initialType?: AccountType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = trigger ? internalOpen : (controlledOpen ?? false);
  const setOpen = trigger ? setInternalOpen : (next: boolean) => onOpenChangeProp?.(next);
  const [pending, startTransition] = useTransition();
```

- [ ] **Step 4: `useForm` default values and the open→reset effect**

Replace:
```tsx
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus),
  });
```
with:
```tsx
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType),
  });
```

Replace the old open-change handler (which both flipped `open` and reset the form — now
split, since `open` can also flip via a controlled prop the handler is never called for):
```tsx
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaultsFor(account, baseCurrency, effectiveBonus));
      setNewGroupName("");
      setNewBankName("");
    }
  }
```
with:
```tsx
  // Runs on every open, however it happened — a trigger click (uncontrolled) or the parent
  // flipping `open` itself (controlled create flow). Resetting only inside the old
  // trigger-click handler missed the controlled path entirely.
  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(account, baseCurrency, effectiveBonus, initialType));
    setNewGroupName("");
    setNewBankName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
```

- [ ] **Step 5: Wire the new handler into the JSX, make `DialogTrigger` conditional**

Replace:
```tsx
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
```
with:
```tsx
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
```

- [ ] **Step 6: Delete the `Type` field and its label lookup**

Remove this whole block (the `Type` `Label` + `Controller` + `Select`, currently sitting
between the Bank field and the Currency field):
```tsx
            <div className="space-y-2">
              <Label>{t("typeLabel")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={typeItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATABLE_TYPES.map((accType) => (
                        <SelectItem key={accType} value={accType}>
                          {tType(accType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

```
(Leave the surrounding `Currency` field block immediately after it untouched — the two-column
grid reflows on its own once this block is gone.)

Remove the now-unused `tType` hook and `typeItems` map:
```tsx
  const tType = useTranslations("AccountTypes");
```
(delete this line — check first that nothing else in the file still calls `tType`; it does
not, once the block above is gone)

```tsx
  const typeItems: Record<string, string> = Object.fromEntries(
    CREATABLE_TYPES.map((accType) => [accType, tType(accType)]),
  );
```
(delete this block too)

- [ ] **Step 7: Remove the now-dead `AccountForm.typeLabel` i18n key**

In `messages/en.json`, `AccountForm` object:
```json
    "typeLabel": "Type",
```
delete this line.

In `messages/es.json`, same spot:
```json
    "typeLabel": "Tipo",
```
delete this line.

- [ ] **Step 8: Verify `account-form-dialog.tsx` compiles clean**

Run: `npx tsc --noEmit && npx eslint components/accounts/account-form-dialog.tsx`
Expected: no errors, no unused-import/unused-var warnings.

- [ ] **Step 9: `account-gallery.tsx` — replace the button with a type-picker select**

Replace the full contents of `components/accounts/account-gallery.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SpotIllustration } from "@/components/brand/spot-illustration";
import { AccountCard } from "./account-card";
import { CardGroupTile } from "./card-group-tile";
import { AccountFormDialog } from "./account-form-dialog";
import {
  ACCOUNT_GROUPS,
  CREATABLE_TYPES,
  accountTypeMeta,
  type AccountType,
  type GroupKey,
} from "@/lib/accounts/meta";
import type {
  AccountWithStatus,
  CurrencyRow,
  CardGroupRow,
  BankRow,
} from "@/lib/accounts/queries";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";

/** Cluster credit cards by card_group_id; solo cards keep a unique key. */
function clusterCards(items: AccountWithStatus[]) {
  const map = new Map<string, AccountWithStatus[]>();
  const order: string[] = [];
  for (const a of items) {
    const key = a.card_group_id ?? `solo:${a.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(a);
  }
  return order.map((key) => ({ key, items: map.get(key)! }));
}

/**
 * The "Add account" entry point IS the type picker now: choosing a type both
 * sets it and opens `AccountFormDialog`, which never asks for it again.
 * Replaces what used to be a plain button opening a dialog with type as just
 * another field inside it — see spec §2.
 */
function AddAccountControl({
  currencies,
  cardGroups,
  banks,
  baseCurrency,
  placeholder,
}: {
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
  placeholder: string;
}) {
  const tType = useTranslations("AccountTypes");
  const [pendingType, setPendingType] = useState<AccountType | null>(null);

  /* Value→label map for the closed trigger — required by lib/select-items.test.ts for any
     Select rendering a SelectValue. */
  const typeItems: Record<string, string> = Object.fromEntries(
    CREATABLE_TYPES.map((accType) => [accType, tType(accType)]),
  );

  return (
    <>
      <Select
        value={pendingType ?? ""}
        onValueChange={(v) => setPendingType(v as AccountType)}
        items={typeItems}
      >
        <SelectTrigger
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-fit justify-start gap-2 border-0 text-primary-foreground data-placeholder:text-primary-foreground",
          )}
        >
          <Plus className="size-4" />
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {CREATABLE_TYPES.map((accType) => {
            const Icon = accountTypeMeta(accType).icon;
            return (
              <SelectItem key={accType} value={accType}>
                <Icon className="size-4" />
                {tType(accType)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <AccountFormDialog
        mode="create"
        currencies={currencies}
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
        initialType={pendingType ?? undefined}
        open={pendingType !== null}
        onOpenChange={(next) => {
          if (!next) setPendingType(null);
        }}
      />
    </>
  );
}

export function AccountGallery({
  accounts,
  currencies,
  cardGroups,
  banks,
  baseCurrency,
  holder,
}: {
  accounts: AccountWithStatus[];
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
  /** Cardholder name for card faces — the profile name, as embossed. */
  holder: string;
}) {
  const t = useTranslations("Accounts");
  const groupById = new Map(cardGroups.map((g) => [g.id, g]));
  const groupLabels: Record<GroupKey, { title: string; blurb: string }> = {
    cash: { title: t("groupCashTitle"), blurb: t("groupCashBlurb") },
    assets: { title: t("groupAssetsTitle"), blurb: t("groupAssetsBlurb") },
    cards: { title: t("groupCardsTitle"), blurb: t("groupCardsBlurb") },
    loans: { title: t("groupLoansTitle"), blurb: t("groupLoansBlurb") },
  };

  if (accounts.length === 0) {
    return (
      <EmptyState
        illustration={<SpotIllustration scene="wallet" className="size-28" />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <AddAccountControl
            currencies={currencies}
            cardGroups={cardGroups}
            banks={banks}
            baseCurrency={baseCurrency}
            placeholder={t("addFirstAccount")}
          />
        }
      />
    );
  }

  const groups = ACCOUNT_GROUPS.map((g) => ({
    ...g,
    items: accounts.filter((a) => accountTypeMeta(a.type).group === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <AddAccountControl
          currencies={currencies}
          cardGroups={cardGroups}
          banks={banks}
          baseCurrency={baseCurrency}
          placeholder={t("addAccount")}
        />
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-foreground">{groupLabels[group.key].title}</h2>
            <span className="text-xs text-muted-foreground">{groupLabels[group.key].blurb}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.key === "cards"
              ? clusterCards(group.items).map((cluster) => {
                  // Whether a card belongs to a card_groups row — not how many
                  // currency lines it currently has — decides whether the
                  // group tile (and its one-per-card face) renders. A card
                  // that is the sole member of a fresh group still belongs to
                  // that group, and must still get a face; `cluster.key` is
                  // only ever a real card_group_id when a group exists (solo
                  // cards key off `solo:${id}`, which never matches).
                  const cardGroup = groupById.get(cluster.key);
                  return cardGroup ? (
                    <CardGroupTile
                      key={cluster.key}
                      name={cardGroup.name}
                      brand={cardGroup.brand}
                      artColor={cardGroup.art_color}
                      holder={holder}
                      accounts={cluster.items}
                    />
                  ) : (
                    <AccountCard key={cluster.key} account={cluster.items[0]} holder={holder} />
                  );
                })
              : group.items.map((account) => (
                  <AccountCard key={account.id} account={account} holder={holder} />
                ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit && npx eslint components/accounts/account-gallery.tsx components/accounts/account-form-dialog.tsx`
Expected: no errors.

Run: `npx vitest run lib/select-items.test.ts`
Expected: PASS — the new `Select` in `account-gallery.tsx` declares `items=`.

- [ ] **Step 11: Commit**

```bash
git add components/accounts/account-form-dialog.tsx components/accounts/account-gallery.tsx messages/en.json messages/es.json
git commit -m "make add-account entry point a type-picker select, remove Type field"
```

---

### Task 4: Account form — required indicators and real error messages

**Files:**
- Modify: `components/accounts/account-form-dialog.tsx`

**Interfaces:**
- Consumes (Task 2): `Label`'s `required` prop, `FieldError`.
- Consumes (Task 3): the file as restructured there (no `Type` field, `initialType` prop).

**Why this file needs a value-cleaning step the others don't:** `accountInput`'s
`superRefine` marks `credit_limit`/`statement_closing_day`/`payment_due_day` (cards) and
`principal`/`term_months`/`installment_amount` (loans) required by checking
`v[f] === undefined`. But these are `z.coerce.number()` fields, and `Number("")` is `0`, not
`NaN` or `undefined` — so a blank numeric `Input` coerces to a *valid* `0` and the
`superRefine` check never fires. The existing `onSubmit` already works around this by mapping
every empty string to `undefined` before calling the server action; the resolver needs the
same mapping to see accurate validity, or it will silently accept blank required numeric
fields (reproducing the exact bug this task fixes). No other form's schema has this
combination — `transactionInput`/`subscriptionInput` use `.positive()` or `.min(1, msg)` (0
or "" already fails those directly) and the goal-contribution schema (Task 7) uses
`.refine((n) => n !== 0, ...)`, which also rejects the coerced `0` directly.

- [ ] **Step 1: Imports**

Add to the top of `components/accounts/account-form-dialog.tsx`:
```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { accountInput } from "@/lib/accounts/schema";
import { FieldError } from "@/components/ui/field-error";
```

- [ ] **Step 2: Shared blank→undefined helper, used by both the resolver and submit**

Add near the top of the file, after the `str` helper:
```tsx
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Every "" becomes undefined — mirrors what `accountInput`'s superRefine checks for
 *  conditionally-required numeric fields (see Task 4 note). Used both to validate on the
 *  client (via the resolver below) and to build the actual submit payload, so the two never
 *  disagree about what counts as "filled in". */
function blankToUndefined<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]),
  ) as T;
}
```

- [ ] **Step 3: Wire the resolver**

Replace:
```tsx
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType),
  });
```
with:
```tsx
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: (values, context, options) =>
      zodResolver(accountInput)(blankToUndefined(values) as FormValues, context, options),
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType),
  });
```

- [ ] **Step 4: Reuse the helper in `onSubmit`, instead of its inline duplicate**

Replace:
```tsx
      const clean = Object.fromEntries(
        Object.entries({ ...bonusValues, card_group_id: normalizedGroup, bank_id: normalizedBank }).map(
          ([k, v]) => [k, v === "" ? undefined : v],
        ),
      ) as Record<string, unknown>;
```
with:
```tsx
      const clean = blankToUndefined({
        ...bonusValues,
        card_group_id: normalizedGroup,
        bank_id: normalizedBank,
      });
```

- [ ] **Step 5: Name field**

Replace:
```tsx
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
            </div>
```
with:
```tsx
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name" required>{t("nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
                required
              />
              <FieldError message={errors.name?.message} />
            </div>
```

- [ ] **Step 6: Currency field**

Replace:
```tsx
            <div className="space-y-2">
              <Label>{t("currencyLabel")}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                   items={currencyItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
```
with:
```tsx
            <div className="space-y-2">
              <Label required>{t("currencyLabel")}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field, fieldState }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                   items={currencyItems}>
                    <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue />
                    </SelectTrigger>
```

Immediately after that `Select`'s closing `/>` (right before the existing
`{mode === "edit" ? ... currencyLockedHint ... : null}` line), add:
```tsx
              <FieldError message={errors.currency?.message} />
```

- [ ] **Step 7: Credit-card fields — `credit_limit`, `statement_closing_day`,
  `payment_due_day` (the card copy only, not the loan copy in Step 9)**

Replace:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">{t("creditLimitLabel")}</Label>
                  <Input id="credit_limit" type="number" step="0.01" min="0" {...register("credit_limit")} />
                </div>
```
with:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="credit_limit" required>{t("creditLimitLabel")}</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.credit_limit}
                    {...register("credit_limit")}
                  />
                  <FieldError message={errors.credit_limit?.message} />
                </div>
```

Replace:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="statement_closing_day">{t("statementClosingDayLabel")}</Label>
                  <Input id="statement_closing_day" type="number" min="1" max="31" {...register("statement_closing_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">{t("paymentDueDayLabel")}</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
```
with:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="statement_closing_day" required>{t("statementClosingDayLabel")}</Label>
                  <Input
                    id="statement_closing_day"
                    type="number"
                    min="1"
                    max="31"
                    aria-invalid={!!errors.statement_closing_day}
                    {...register("statement_closing_day")}
                  />
                  <FieldError message={errors.statement_closing_day?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day" required>{t("paymentDueDayLabel")}</Label>
                  <Input
                    id="payment_due_day"
                    type="number"
                    min="1"
                    max="31"
                    aria-invalid={!!errors.payment_due_day}
                    {...register("payment_due_day")}
                  />
                  <FieldError message={errors.payment_due_day?.message} />
                </div>
```

- [ ] **Step 8: Welcome-bonus fields — required only while the toggle is on (all three
  together, matching the superRefine's all-or-none rule)**

Replace:
```tsx
                      <div className="space-y-2">
                        <Label htmlFor="welcome_bonus_goal_amount">{t("welcomeBonusGoalAmountLabel")}</Label>
                        <Input
                          id="welcome_bonus_goal_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          {...register("welcome_bonus_goal_amount")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("welcomeBonusGoalCurrencyLabel")}</Label>
                        <Controller
                          control={control}
                          name="welcome_bonus_goal_currency"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.code} · {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="welcome_bonus_due_date">{t("welcomeBonusDueDateLabel")}</Label>
                        <Input id="welcome_bonus_due_date" type="date" {...register("welcome_bonus_due_date")} />
                      </div>
```
with:
```tsx
                      <div className="space-y-2">
                        <Label htmlFor="welcome_bonus_goal_amount" required>{t("welcomeBonusGoalAmountLabel")}</Label>
                        <Input
                          id="welcome_bonus_goal_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          aria-invalid={!!errors.welcome_bonus_goal_amount}
                          {...register("welcome_bonus_goal_amount")}
                        />
                        <FieldError message={errors.welcome_bonus_goal_amount?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label required>{t("welcomeBonusGoalCurrencyLabel")}</Label>
                        <Controller
                          control={control}
                          name="welcome_bonus_goal_currency"
                          render={({ field, fieldState }) => (
                            <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                              <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.code} · {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError message={errors.welcome_bonus_goal_currency?.message} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="welcome_bonus_due_date" required>{t("welcomeBonusDueDateLabel")}</Label>
                        <Input
                          id="welcome_bonus_due_date"
                          type="date"
                          aria-invalid={!!errors.welcome_bonus_due_date}
                          {...register("welcome_bonus_due_date")}
                        />
                        <FieldError message={errors.welcome_bonus_due_date?.message} />
                      </div>
```

- [ ] **Step 9: Loan fields — `principal`, `term_months`, `installment_amount` required;
  `payment_due_day`'s loan copy stays unmarked (not in the loan branch of the schema's
  `superRefine`)**

Replace:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="principal">{t("principalLabel")}</Label>
                  <Input id="principal" type="number" step="0.01" min="0" {...register("principal")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">{t("interestRateLabel")}</Label>
                  <Input id="interest_rate" type="number" step="0.0001" min="0" placeholder={t("interestRatePlaceholder")} {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_months">{t("termMonthsLabel")}</Label>
                  <Input id="term_months" type="number" min="1" {...register("term_months")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_term_months">{t("originalTermMonthsLabel")}</Label>
                  <Input
                    id="original_term_months"
                    type="number"
                    min="1"
                    placeholder={t("originalTermPlaceholder")}
                    {...register("original_term_months")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installment_amount">{t("installmentAmountLabel")}</Label>
                  <Input id="installment_amount" type="number" step="0.01" min="0" {...register("installment_amount")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">{t("paymentDueDayLabel")}</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
```
with:
```tsx
                <div className="space-y-2">
                  <Label htmlFor="principal" required>{t("principalLabel")}</Label>
                  <Input
                    id="principal"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.principal}
                    {...register("principal")}
                  />
                  <FieldError message={errors.principal?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">{t("interestRateLabel")}</Label>
                  <Input id="interest_rate" type="number" step="0.0001" min="0" placeholder={t("interestRatePlaceholder")} {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_months" required>{t("termMonthsLabel")}</Label>
                  <Input
                    id="term_months"
                    type="number"
                    min="1"
                    aria-invalid={!!errors.term_months}
                    {...register("term_months")}
                  />
                  <FieldError message={errors.term_months?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_term_months">{t("originalTermMonthsLabel")}</Label>
                  <Input
                    id="original_term_months"
                    type="number"
                    min="1"
                    placeholder={t("originalTermPlaceholder")}
                    {...register("original_term_months")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installment_amount" required>{t("installmentAmountLabel")}</Label>
                  <Input
                    id="installment_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.installment_amount}
                    {...register("installment_amount")}
                  />
                  <FieldError message={errors.installment_amount?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">{t("paymentDueDayLabel")}</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
```

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit && npx eslint components/accounts/account-form-dialog.tsx`
Expected: no errors.

Run: `npx vitest run lib/accounts/schema.test.ts lib/select-items.test.ts`
Expected: PASS (this task doesn't touch the schema itself, just confirms nothing broke).

- [ ] **Step 11: Commit**

```bash
git add components/accounts/account-form-dialog.tsx
git commit -m "wire zod validation, required markers, and inline errors into the account form"
```

---

### Task 5: Transaction form — required indicators and real error messages

**Files:**
- Modify: `components/transactions/transaction-form.tsx`

**Interfaces:**
- Consumes (Task 2): `Label`'s `required` prop, `FieldError`.

`transactionInput` needs no value-cleaning wrapper (see Task 4's note) — `account_id`/
`to_account_id`/`category_id` are checked for falsiness (`""` already fails), `amount` uses
`.positive()` (`0` already fails), and `occurred_at` uses `.min(1, ...)` (`""` already fails).

- [ ] **Step 1: Imports**

Replace:
```tsx
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/transactions/schema";
```
with:
```tsx
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, transactionInput, type TransactionType } from "@/lib/transactions/schema";
```

Add, next to the other `components/ui/*` imports:
```tsx
import { FieldError } from "@/components/ui/field-error";
```

- [ ] **Step 2: Wire the resolver, track a `transferRateError` for the one field the
  schema doesn't own (`transfer_rate` is UI-only, converted to `to_amount` before submit)**

Replace:
```tsx
  const { register, handleSubmit, control, setValue, getValues } = useForm<FormValues>({
```
with:
```tsx
  const [transferRateError, setTransferRateError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(transactionInput),
```

(the existing `defaultValues: transaction ? {...} : {...}` block that follows stays exactly
as-is — this only adds the `resolver` line and the `formState` destructure above it)

- [ ] **Step 3: Clear the transfer-rate error whenever the rate is edited**

There's already an effect clearing `transfer_rate` itself when the currency pair changes.
Add a second, small effect right after it clears the error on any edit to the rate:
```tsx
  useEffect(() => {
    setTransferRateError(null);
  }, [transferRateRaw]);
```
(place this after the existing `useEffect` that watches `pairKey`, so both effects sit
together near the top of the component body, before `onSubmit`)

- [ ] **Step 4: Surface the transfer-rate check as a field error, not just a toast**

Replace:
```tsx
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }
```
with:
```tsx
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      setTransferRateError(t("transferRateInvalid"));
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }
```

- [ ] **Step 5: Amount field**

Replace:
```tsx
      <div className="space-y-2">
        <Label htmlFor="amount">{t("amountLabel")}</Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder={t("amountPlaceholder")}
            className="pr-16"
            aria-describedby="amount_currency"
            {...register("amount")}
            required
            disabled={fromStatement}
          />
```
with:
```tsx
      <div className="space-y-2">
        <Label htmlFor="amount" required>{t("amountLabel")}</Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder={t("amountPlaceholder")}
            className="pr-16"
            aria-describedby="amount_currency"
            aria-invalid={!!errors.amount}
            {...register("amount")}
            required
            disabled={fromStatement}
          />
```

A few lines below, right after that `<span id="amount_currency">...</span>` closes (still
inside the outer `<div className="relative">`'s parent `<div className="space-y-2">`, before
the `{crossCurrency && src && dst ? (...) : null}` block), add:
```tsx
        <FieldError message={errors.amount?.message} />
```

- [ ] **Step 6: Transfer-rate field**

Replace:
```tsx
              <Label htmlFor="transfer_rate" className="text-xs font-normal text-muted-foreground">
                {t("ratePrefix", { currency: src.currency })}
              </Label>
              <Input
                id="transfer_rate"
                type="number"
                step="0.00000001"
                min="0"
                className="h-8 w-32"
                placeholder={t("ratePlaceholder")}
                required
                {...register("transfer_rate")}
              />
              <span className="text-xs text-muted-foreground">{dst.currency}</span>
            </div>
```
with:
```tsx
              <Label htmlFor="transfer_rate" required className="text-xs font-normal text-muted-foreground">
                {t("ratePrefix", { currency: src.currency })}
              </Label>
              <Input
                id="transfer_rate"
                type="number"
                step="0.00000001"
                min="0"
                className="h-8 w-32"
                placeholder={t("ratePlaceholder")}
                aria-invalid={!!transferRateError}
                required
                {...register("transfer_rate")}
              />
              <span className="text-xs text-muted-foreground">{dst.currency}</span>
            </div>
            <FieldError message={transferRateError ?? undefined} />
```

- [ ] **Step 7: Source account field**

Replace:
```tsx
      <div className="space-y-2">
        <Label>{SOURCE_LABEL[type]}</Label>
        <Controller
          control={control}
          name="account_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={fromStatement} items={accountItems}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{groupedAccountOptions(selectableAccounts)}</SelectContent>
            </Select>
          )}
        />
      </div>
```
with:
```tsx
      <div className="space-y-2">
        <Label required>{SOURCE_LABEL[type]}</Label>
        <Controller
          control={control}
          name="account_id"
          render={({ field, fieldState }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={fromStatement} items={accountItems}>
              <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{groupedAccountOptions(selectableAccounts)}</SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.account_id?.message} />
      </div>
```

- [ ] **Step 8: Destination account field (payment only)**

Replace:
```tsx
      {type === "payment" ? (
        <div className="space-y-2">
          <Label>{t("toLabel")}</Label>
          <Controller
            control={control}
            name="to_account_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} items={accountItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("toPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {groupedAccountOptions(accounts.filter((a) => a.id !== accountId))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}
```
with:
```tsx
      {type === "payment" ? (
        <div className="space-y-2">
          <Label required>{t("toLabel")}</Label>
          <Controller
            control={control}
            name="to_account_id"
            render={({ field, fieldState }) => (
              <Select value={field.value} onValueChange={field.onChange} items={accountItems}>
                <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                  <SelectValue placeholder={t("toPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {groupedAccountOptions(accounts.filter((a) => a.id !== accountId))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.to_account_id?.message} />
        </div>
      ) : null}
```

- [ ] **Step 9: Category field (required for expense, optional for payment)**

Replace:
```tsx
      {type !== "income" ? (
        <div className="space-y-2">
          <Label>
            {t("categoryLabel")}
            {type === "payment" ? t("categoryOptionalSuffix") : ""}
          </Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange} items={categoryItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
```
with:
```tsx
      {type !== "income" ? (
        <div className="space-y-2">
          <Label required={type === "expense"}>
            {t("categoryLabel")}
            {type === "payment" ? t("categoryOptionalSuffix") : ""}
          </Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field, fieldState }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange} items={categoryItems}>
                <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                  <SelectValue />
                </SelectTrigger>
```

A few lines further, the block currently ends with:
```tsx
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}
```
(this is the category block's closing — distinguish it from the destination block above by
the `categoryItems` reference a few lines up) — replace with:
```tsx
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.category_id?.message} />
        </div>
      ) : null}
```

- [ ] **Step 10: Date field**

Replace:
```tsx
        <div className="space-y-2">
          <Label htmlFor="occurred_at">{t("dateLabel")}</Label>
          <Input id="occurred_at" type="date" {...register("occurred_at")} disabled={fromStatement} />
        </div>
```
with:
```tsx
        <div className="space-y-2">
          <Label htmlFor="occurred_at" required>{t("dateLabel")}</Label>
          <Input
            id="occurred_at"
            type="date"
            aria-invalid={!!errors.occurred_at}
            {...register("occurred_at")}
            disabled={fromStatement}
          />
          <FieldError message={errors.occurred_at?.message} />
        </div>
```

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit && npx eslint components/transactions/transaction-form.tsx`
Expected: no errors.

Run: `npx vitest run lib/transactions/schema.test.ts`
Expected: PASS (confirms the schema itself is untouched).

- [ ] **Step 12: Commit**

```bash
git add components/transactions/transaction-form.tsx
git commit -m "wire zod validation, required markers, and inline errors into the transaction form"
```

---

### Task 6: Subscription form — required indicators and real error messages

**Files:**
- Modify: `components/subscriptions/subscription-form-dialog.tsx`

**Interfaces:**
- Consumes (Task 2): `Label`'s `required` prop, `FieldError`.

No value-cleaning wrapper needed — `subscriptionInput`'s required fields (`name`, `amount`,
`currency`, `billing_cycle`) either fail `.min(1, ...)` on `""` directly, or (like
`transactionInput`'s Selects) are backed by a `Select` that always carries a real default and
can never structurally reach the resolver blank.

- [ ] **Step 1: Imports**

Replace:
```tsx
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BILLING_CYCLES, CYCLE_LABEL, type BillingCycle } from "@/lib/subscriptions/cycle";
```
with:
```tsx
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BILLING_CYCLES, CYCLE_LABEL, type BillingCycle } from "@/lib/subscriptions/cycle";
import { subscriptionInput } from "@/lib/subscriptions/schema";
```

Add, next to the other `components/ui/*` imports:
```tsx
import { FieldError } from "@/components/ui/field-error";
```

- [ ] **Step 2: Wire the resolver**

Replace:
```tsx
  const { register, handleSubmit, control, reset } = useForm<Values>({
    defaultValues: defaults(subscription, baseCurrency),
  });
```
with:
```tsx
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(subscriptionInput),
    defaultValues: defaults(subscription, baseCurrency),
  });
```

- [ ] **Step 3: Name field**

Replace:
```tsx
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
            </div>
```
with:
```tsx
            <div className="space-y-2">
              <Label htmlFor="name" required>{t("nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
                required
              />
              <FieldError message={errors.name?.message} />
            </div>
```

- [ ] **Step 4: Amount + currency field**

Replace:
```tsx
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amountLabel")}</Label>
              <div className="flex gap-2">
                <Input id="amount" type="number" step="0.01" min="0" className="flex-1" {...register("amount")} required />
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
```
with:
```tsx
            <div className="space-y-2">
              <Label htmlFor="amount" required>{t("amountLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="flex-1"
                  aria-invalid={!!errors.amount}
                  {...register("amount")}
                  required
                />
                <Controller
                  control={control}
                  name="currency"
                  render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                      <SelectTrigger className="w-24" aria-invalid={!!fieldState.error}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <FieldError message={errors.amount?.message ?? errors.currency?.message} />
            </div>
```

- [ ] **Step 5: Billing cycle field**

Replace:
```tsx
            <div className="space-y-2">
              <Label>{t("billingCycleLabel")}</Label>
              <Controller
                control={control}
                name="billing_cycle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={cycleItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
```
with:
```tsx
            <div className="space-y-2">
              <Label required>{t("billingCycleLabel")}</Label>
              <Controller
                control={control}
                name="billing_cycle"
                render={({ field, fieldState }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={cycleItems}>
                    <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue />
                    </SelectTrigger>
```

A few lines further, this block ends with:
```tsx
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
```
replace with:
```tsx
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.billing_cycle?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint components/subscriptions/subscription-form-dialog.tsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/subscriptions/subscription-form-dialog.tsx
git commit -m "wire zod validation, required markers, and inline errors into the subscription form"
```

---

### Task 7: Goal-contribution dialog — real validation, required indicators

**Files:**
- Modify: `components/goals/contribute-dialog.tsx`

**Interfaces:** none produced for later tasks — `goal-actions.ts`'s own `contributionSchema`
is untouched (see spec §3's amendment: `goal_id` isn't a form field, and this form's two
existing checks are already localized, so a shared hardcoded-English schema would regress
Spanish — a form-scoped schema factory lives in this file instead, mirroring the
`goalSchema(nameRequired)` pattern already in `goal-actions.ts`).

- [ ] **Step 1: Imports**

Replace:
```tsx
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
```
with:
```tsx
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
```

Add, next to the other `components/ui/*` imports:
```tsx
import { FieldError } from "@/components/ui/field-error";
```

- [ ] **Step 2: Form-scoped schema factory**

Add after the `today()` helper, before the component:
```tsx
const today = () => new Date().toISOString().slice(0, 10);

function contributionFormSchema(messages: { pickAccount: string; amountRequired: string; pickDate: string }) {
  return z.object({
    account_id: z.string().uuid(messages.pickAccount),
    amount: z.coerce.number().refine((n) => n !== 0, messages.amountRequired),
    occurred_at: z.string().min(1, messages.pickDate),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  });
}

type Values = { amount: string; occurred_at: string; note: string; exchange_rate: string };
```
(the existing `type Values = {...}` line moves down to just after the new schema factory;
`exchange_rate` deliberately stays outside the schema — see Step 5)

- [ ] **Step 3: Replace `useState`-driven `accountId` with a `Controller` field, wire the
  resolver**

Replace:
```tsx
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [withdraw, setWithdraw] = useState(false);
  const router = useRouter();
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const { register, handleSubmit, reset, setValue } = useForm<Values>({
    defaultValues: { amount: "", occurred_at: today(), note: "", exchange_rate: "" },
  });

  const account = accounts.find((a) => a.id === accountId);
```
with:
```tsx
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [withdraw, setWithdraw] = useState(false);
  const router = useRouter();
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: (values, context, options) =>
      zodResolver(
        contributionFormSchema({
          pickAccount: t("pickAccount"),
          amountRequired: t("amountRequired"),
          pickDate: t("pickDate"),
        }),
      )(values, context, options),
    defaultValues: {
      account_id: accounts[0]?.id ?? "",
      amount: "",
      occurred_at: today(),
      note: "",
      exchange_rate: "",
    },
  });

  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const account = accounts.find((a) => a.id === accountId);
```

This introduces `account_id` into `Values` and needs `useWatch` imported — replace:
```tsx
import { useForm, Controller } from "react-hook-form";
```
with:
```tsx
import { useForm, useWatch, Controller } from "react-hook-form";
```
(Step 1 already added `Controller` to this line — extend the same import line with
`useWatch` rather than duplicating it)

Update the `Values` type from Step 2 to include `account_id`:
```tsx
type Values = { account_id: string; amount: string; occurred_at: string; note: string; exchange_rate: string };
```

- [ ] **Step 4: `onOpenChange` and `onSubmit` — drop the manual `useState`/toast checks
  now caught by the resolver, keep the exchange-rate check (schema doesn't own it — see
  Step 5)**

Replace:
```tsx
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ amount: "", occurred_at: today(), note: "", exchange_rate: "" });
      setAccountId(accounts[0]?.id ?? "");
      setWithdraw(false);
    }
  }

  function onSubmit(values: Values) {
    if (!accountId) {
      toast.error(t("pickAccount"));
      playError();
      return;
    }
    const magnitude = Math.abs(Number(values.amount));
    if (!Number.isFinite(magnitude) || magnitude === 0) {
      toast.error(t("amountRequired"));
      playError();
      return;
    }
    startTransition(async () => {
      const result = await addContribution({
        goal_id: goal.id,
        account_id: accountId,
        amount: withdraw ? -magnitude : magnitude,
        exchange_rate: crossCurrency ? values.exchange_rate || 1 : 1,
        occurred_at: values.occurred_at,
        note: values.note,
      });
```
with:
```tsx
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({
        account_id: accounts[0]?.id ?? "",
        amount: "",
        occurred_at: today(),
        note: "",
        exchange_rate: "",
      });
      setWithdraw(false);
    }
  }

  function onSubmit(values: Values) {
    const magnitude = Math.abs(Number(values.amount));
    if (crossCurrency && !(Number(values.exchange_rate) > 0)) {
      toast.error(tc("crossCurrencyRateRequired"));
      playError();
      return;
    }
    startTransition(async () => {
      const result = await addContribution({
        goal_id: goal.id,
        account_id: values.account_id,
        amount: withdraw ? -magnitude : magnitude,
        exchange_rate: crossCurrency ? values.exchange_rate || 1 : 1,
        occurred_at: values.occurred_at,
        note: values.note,
      });
```

- [ ] **Step 5: Account field — `Select` becomes a `Controller` field**

Replace:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-account">{t("accountLabel")}</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v ?? "");
                  // A rate typed for the previous account is meaningless for a
                  // different one — clearing it forces a fresh entry instead of
                  // silently converting at the wrong rate (or, for a same-
                  // currency account, hiding a stale value that would only
                  // resurface if the user switches back to a foreign account).
                  setValue("exchange_rate", "");
                }}
                items={accountItems}
              >
                <SelectTrigger id="contrib-account" className="w-full">
                  <SelectValue placeholder={t("accountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
```
with:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-account" required>{t("accountLabel")}</Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field, fieldState }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v ?? "");
                      // A rate typed for the previous account is meaningless for a
                      // different one — clearing it forces a fresh entry instead of
                      // silently converting at the wrong rate (or, for a same-
                      // currency account, hiding a stale value that would only
                      // resurface if the user switches back to a foreign account).
                      setValue("exchange_rate", "");
                    }}
                    items={accountItems}
                  >
                    <SelectTrigger id="contrib-account" className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue placeholder={t("accountPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.account_id?.message} />
            </div>
```

- [ ] **Step 6: Amount field**

Replace:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-amount">
                {t("amountLabel", { currency: account?.currency ?? baseCurrency })}
              </Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                required
                className="tabular-nums"
                {...register("amount")}
              />
            </div>
```
with:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-amount" required>
                {t("amountLabel", { currency: account?.currency ?? baseCurrency })}
              </Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                required
                aria-invalid={!!errors.amount}
                className="tabular-nums"
                {...register("amount")}
              />
              <FieldError message={errors.amount?.message} />
            </div>
```

- [ ] **Step 7: Exchange-rate field (cross-currency only) — required marker, no schema
  field, so no `errors.exchange_rate` to read; validated inline in `onSubmit` (Step 4)**

Replace:
```tsx
            {crossCurrency && (
              <div className="space-y-2">
                <Label htmlFor="contrib-rate">
                  {t("rateLabel", { from: account!.currency, to: baseCurrency })}
                </Label>
                <Input
                  id="contrib-rate"
                  type="number"
                  step="0.00000001"
                  min="0.00000001"
                  required
                  className="tabular-nums"
                  {...register("exchange_rate")}
                />
              </div>
            )}
```
with:
```tsx
            {crossCurrency && (
              <div className="space-y-2">
                <Label htmlFor="contrib-rate" required>
                  {t("rateLabel", { from: account!.currency, to: baseCurrency })}
                </Label>
                <Input
                  id="contrib-rate"
                  type="number"
                  step="0.00000001"
                  min="0.00000001"
                  required
                  className="tabular-nums"
                  {...register("exchange_rate")}
                />
              </div>
            )}
```

- [ ] **Step 8: Date field**

Replace:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-date">{t("dateLabel")}</Label>
              <Input id="contrib-date" type="date" required {...register("occurred_at")} />
            </div>
```
with:
```tsx
            <div className="space-y-2">
              <Label htmlFor="contrib-date" required>{t("dateLabel")}</Label>
              <Input
                id="contrib-date"
                type="date"
                required
                aria-invalid={!!errors.occurred_at}
                {...register("occurred_at")}
              />
              <FieldError message={errors.occurred_at?.message} />
            </div>
```

- [ ] **Step 9: Add the new `pickDate` translation key**

In `messages/en.json`, `ContributeDialog` object (after `"amountRequired": "Enter an
amount"`, currently the last key before `},` at line 384):
```json
    "pickAccount": "Pick an account to save from",
    "amountRequired": "Enter an amount",
    "pickDate": "Pick a date"
```

In `messages/es.json`, same spot:
```json
    "pickAccount": "Elige una cuenta desde la que ahorrar",
    "amountRequired": "Ingresa un monto",
    "pickDate": "Elige una fecha"
```

- [ ] **Step 10: Verify**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"`
Expected: no output.

Run: `npx tsc --noEmit && npx eslint components/goals/contribute-dialog.tsx`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add components/goals/contribute-dialog.tsx messages/en.json messages/es.json
git commit -m "wire zod validation, required markers, and inline errors into the goal-contribution dialog"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (ask before starting if one might already be running — see project
convention).

- [ ] **Step 2: Wallet rename**

Load the app. Confirm the bottom nav (mobile) and sidebar (desktop) both show "Wallet"
instead of "Accounts", and the `/accounts` page's own heading reads "Wallet". Switch language
to Spanish and confirm "Billetera" appears in both spots. Open Help, confirm its "Accounts"
section heading now reads "Wallet" / "Billetera".

- [ ] **Step 3: Add-account type picker — one of each type**

On the Wallet page, click the "Add account" control. Confirm it's a select-style control with
a `Plus` icon, and opening it shows one row per account type (checking, savings, cash,
investment, asset, credit card, loan), each with its own icon. Pick "Credit card" — confirm
the dialog opens with no `Type` field anywhere in the form, and the card-specific fields
(credit limit, statement closing day, payment due day, card group, welcome bonus) are
present. Fill in the required fields and save; confirm the created account is a credit card.
Repeat once for "Loan" (confirm loan fields render, no Type field) and once for "Checking"
(confirm neither card nor loan fields render).

- [ ] **Step 4: Empty-state add-account picker**

If there's a way to reach zero accounts (a fresh test user, or temporarily via an existing
account's Delete flow), confirm the empty state's "Add your first account" control is the
same type-picker select, not a plain button.

- [ ] **Step 5: Edit mode has no Type field**

Open an existing account's Edit dialog (pencil button). Confirm there is no `Type` field —
type is fixed at whatever it was created as.

- [ ] **Step 6: Account form — required indicators and inline errors**

Open "Add account", pick "Credit card". Confirm `Name`, `Currency`, `Credit limit`,
`Statement closing day`, and `Payment due day` all show a red `*`. Leave `Credit limit` blank
and try to save — confirm the dialog does NOT close, does NOT hit the network (no toast
saying something vague), and instead shows a red inline message under the `Credit limit`
field, with its border/ring turned red. Fill it in, confirm the error clears once you retry
submit (or on-change, depending on RHF's revalidation timing) and the account saves. Toggle
"Track a welcome bonus goal" on, leave its three fields blank, submit — confirm all three
show inline errors instead of a silent submit or a bare toast.

- [ ] **Step 7: Transaction form — required indicators and inline errors**

Open the transaction Quick Add. Confirm `Amount`, the source-account select, and `Date` show
a red `*`. Switch to "Expense" and confirm `Category` also shows `*`; switch to "Payment" and
confirm `Category` loses its `*` (shows the existing "(optional)" suffix instead) while
`To` gains one. Pick two accounts in different currencies for a payment, leave the rate
blank, submit — confirm an inline red message appears under the rate field (not just a
toast).

- [ ] **Step 8: Subscription form — required indicators and inline errors**

Open "Add subscription". Confirm `Name`, `Amount`, the currency select, and `Billing cycle`
show `*`. Submit with `Name` blank — confirm an inline error appears under `Name` and the
dialog stays open.

- [ ] **Step 9: Goal-contribution dialog — required indicators and inline errors**

Open a goal's "Add" (contribute) dialog. Confirm `From account`, `Amount`, and `Date` show
`*`. Clear the amount field's value and submit — confirm an inline error appears under
`Amount` (in English regardless of locale, since the schema draws from `ContributeDialog`'s
existing translated `amountRequired`/`pickAccount` strings, so this should actually appear in
Spanish too when the language is set to Spanish — confirm that). Pick an account in a
different currency than the goal's base currency, leave the rate blank, submit — confirm the
existing cross-currency-rate toast still fires.

- [ ] **Step 10: Final check**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: no errors, all tests pass.
