# Quick Add — compact mode (UX-01)

**Status:** approved design, not yet implemented
**Audit item:** UX-01 · Fix · High — *"Quick Add asks for ten things to log a RD$250 lunch"*
(`docs/product-audit-dominican-market.md`)

---

## Problem

`components/quick-add/quick-add-dialog.tsx:18` renders the full `TransactionForm` —
638 lines, up to eleven fields — for the single most repeated action in the product. On mobile
it opens as a 90dvh scrolling sheet.

The form is already smarter than the audit credits: the FX rate appears only on a genuine
cross-currency payment, fee toggles only for bank-account sources, category hides for income,
and a `useEffect` sets tax/fee/budget-exclusion defaults. The real always-visible cost is five
fields (type, amount, account, category, date) plus description and notes.

Two things are genuinely missing rather than merely dense:

- **No last-used memory.** `firstAccount` picks the first bank account by `sort_order`;
  category defaults to `categories[0]`. Neither reflects what the user actually does.
- **Category is a dropdown**, so the most frequent choice in the most frequent action costs a
  popup open, a scroll and a tap.

## Goals

- Log a typical expense in **three taps**: open → type amount → tap a category chip → Guardar.
- **Lose nothing.** Every field reachable today stays reachable, with its current validation and
  its current smart default.
- Defaults that match how the money actually moves in the DR (see *Tax and fee defaults*).

## Non-goals

- No change to editing existing transactions — stored values always win.
- No bottom-sheet / nav rework. A compact form no longer fills 90dvh, so UX-08 stays separate.
- No change to `/transactions` layout. It renders the same component uncollapsed.

---

## 1 · Tax and fee defaults

The transfer tax is an *impuesto por débito a cuenta* — it follows the bank debit. Today the app
defaults `include_tax` on only for a payment into a loan, and `include_commission` on when the
source marks the fee obligatory and the transfer is cross-bank. Both change:

| type | source | destination | `include_tax` | `include_commission` |
|---|---|---|---|---|
| gasto | checking / savings | — | **on** | off |
| gasto | cash / credit card | — | off | off |
| pago | checking / savings | credit card, loan | **on** | off |
| pago | checking / savings | cash, checking, savings | off | off |
| pago | cash / credit card | anything | off | off |
| ingreso | any | — | off | off |

Both remain user-overridable everywhere they apply. The network fee is never on by default; it is
added deliberately when a particular transfer actually charged one.

These defaults apply in **both** modes — a transaction created from `/transactions` gets them too.
Consistency matters more than blast radius here, and the values are visible before saving.

Unaffected: `app/(app)/subscriptions/actions.ts:247` sets both flags `false` explicitly.

### Where the money is actually computed

`tax_amount` and `fee_amount` are computed by a Postgres trigger, not by the app
(`supabase/migrations/20260719031353_banks_normalize.sql:64`):

```sql
new.tax_amount := case when new.include_tax
  then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4) else 0 end;
new.fee_amount := case when new.include_commission and not same_bank
  then coalesce(src.network_fee_amount, 0) else 0 end;
```

The trigger stays authoritative. Changing defaults is app-side only — **no migration**, which
matters because migrations to the live project need a human push.

---

## 2 · Pure logic — `lib/transactions/defaults.ts` (new)

The repo tests pure `lib/` modules and has no component tests or jsdom setup. Every decidable rule
moves out of the component so it can be tested the way the rest of the codebase is.

```ts
rankCategories(recentCategoryIds, categories)  // most-used first, ties keep sort_order
defaultAccount(recentRows, accounts)           // last-used; falls back to today's rule
resolveFeeDefaults({ type, src, dst })         // → { include_tax, include_commission }
feeParts({ amount, src, dst, flags, sameBank })// → { tax, fee }, for the preview line
```

`resolveFeeDefaults` replaces the three `setValue` calls in the `useEffect` at
`transaction-form.tsx:239`. `defaultAccount` preserves the existing fallback chain, with recency
inserted: explicit `defaultAccountId` prop → most recent source account → first bank account →
`accounts[0]`.

> **Accepted risk — duplicated arithmetic.** `feeParts` mirrors the trigger's math in TypeScript
> because the preview line must show a figure before the row exists, and only the trigger computes
> the real one. The two can diverge in two ways, both accepted rather than engineered against:
>
> - **Rounding.** Postgres rounds `numeric` half away from zero; JavaScript works in binary floats.
>   A sub-cent disagreement on an exact half is possible. It does not matter: `feeParts` feeds a
>   preview, never a stored value. `tax_amount`, `fee_amount` and `total_amount` are always the
>   trigger's, and those are what every balance, budget and insight reads.
> - **A future trigger change.** Migrations are immutable once applied, so changing this arithmetic
>   means writing a *new* migration — a deliberate act, done with this document in hand. Whoever
>   does it updates `feeParts` in the same change.
>
> There is no local Postgres in this repo (no `supabase start`, no seed, and `vitest run` is pure
> Node), so no automated test can compare the two sides. Do not write one that appears to.
> `lib/transactions/defaults.ts` carries a comment naming the trigger and the migration it lives
> in; the pointer goes one way only, since the migration cannot be edited.

## 3 · Data — one more query in `getQuickAddData`

A fifth promise in the existing `Promise.all` (`lib/transactions/queries.ts:145`):

```sql
select account_id, category_id, type
from transactions
where type in ('expense','payment')
order by occurred_at desc, id desc
limit 60
```

Adds `recentAccountId: string | null` and `categoryOrder: string[]` to `QuickAddData`. Category
ranking counts expense rows only — income carries no category and payments default to `none`.

No new column, no migration, works across devices, self-correcting as habits change.

## 4 · Component — `TransactionForm` gains `compact?: boolean`

Not passed → byte-identical to today on `/transactions` and in the edit dialog.
Passed → starts collapsed, and `Más detalles` expands **the exact field set that renders today**,
in place, preserving typed values.

That is what makes "nothing lost" structurally true rather than a promise: the expanded state *is*
the current form. There is one component, one resolver, one set of validation rules.

- Expansion is sticky across type switches — flipping Gasto→Pago mid-entry must not collapse what
  the user opened.
- `fromStatement` rows are never compact; statement editing always renders expanded.

### Compact layout, per type

```
GASTO                          PAGO
┌────────────────────────┐    ┌────────────────────────┐
│ [Gasto] Ingreso  Pago  │    │ Gasto  Ingreso [Pago]  │
│                        │    │                        │
│     RD$ 250.00         │    │     US$ 200.00         │
│     ─────────────      │    │     ─────────────      │
│  +RD$0.50 impuesto ·   │    │  1 USD = [63.50] DOP   │
│  sin comisión   editar │    │  → llegan RD$12,700    │
│                        │    │                        │
│  🍔 Comida  🚗 Transp › │    │  Popular → Visa · hoy  │
│                        │    │                        │
│  Popular ····5850 ·hoy │    │  ⌄ Más detalles        │
│                        │    │  [      Guardar     ]  │
│  ⌄ Más detalles        │    └────────────────────────┘
│  [      Guardar     ]  │
└────────────────────────┘     INGRESO — amount + account
                               line only; no category, as today.
```

The FX rate row appears inline only when `crossCurrency` is true — the condition the form already
computes at `transaction-form.tsx:216`. Every type is completable without expanding.

### New sub-components

| Component | Behaviour |
|---|---|
| `CategoryRail` | Horizontal chips from each category's `emoji` / `color`. Top 5 by `categoryOrder`, `›` opens the existing `Select` with the full list. Keyboard-navigable. |
| `AccountDateLine` | `Popular ····5850 · hoy` — two independent tap targets opening the account `Select` and a date control. |
| `FeeSummaryLine` | Muted; rendered only when tax or fee is non-zero. `editar` sets `expanded = true`. |

Amount in compact: large type, `autoFocus`, `inputMode="decimal"` — `type="number"` alone does not
reliably raise a numeric keypad. Keeps the currency suffix and its `aria-describedby`.

---

## 5 · Testing

`vitest`, pure functions only, matching the existing pattern (`lib/transactions/search.test.ts`):

- `rankCategories` — frequency order, tie-breaking, unseen categories, empty history.
- `defaultAccount` — the full fallback chain including archived/missing accounts.
- `resolveFeeDefaults` — every row of the table in §1.
- `feeParts` — its own expectations, including the same-bank waiver. These assert what the preview
  shows, not that Postgres agrees; see the accepted risk in §2.

No component tests; the repo has none and no jsdom is configured.

## 6 · Also required

- **i18n** — new keys in `messages/en` and `messages/es`.
- **Help guide** — the in-app guide page and its mocks must reflect the new Quick Add and the new
  tax/fee defaults, in both languages.

---

## 7 · Known issue this depends on

**Selects misbehave inside the Quick Add dialog on mobile.** Unproven, logged during design.

*Repro:* on a phone, open Quick Add → open a Select → choose a value → open the same Select again.
The page content becomes magnified.

*Ruled out:*
- Viewport meta is correct — Next merges `app/layout.tsx:73` onto
  `{ width: 'device-width', initialScale: 1 }` (`next/dist/lib/metadata/default-metadata.js:23`).
- iOS auto-zoom-on-focus — `Input` is `text-base md:text-sm` (16px on mobile), and `SelectTrigger`
  is a `<button>`, which iOS does not auto-zoom.

*Leading hypothesis:* on the second open the popup is positioned against the now-selected item,
changing its measured size, which is the input to the scroll-lock threshold at
`useAnchoredPopupScrollLock.js:33` (`popupWidth >= viewportWidth - 20`). A scroll lock engaging on
the second open alters body layout, and iOS responds by inflating text.

*Also found, independently real:* `components/ui/select.tsx:87` sets
`data-align-trigger={alignItemWithTrigger}` from the **prop**, which defaults to `true`. Base UI
disables align-item-with-trigger mode at runtime for touch-initiated opens
(`SelectPositioner.js:81-84`), so on mobile the CSS guard `data-[align-trigger=true]:animate-none`
suppresses the animation for a positioning mode that is not actually active.

**Relevance:** the compact layout leans on Selects for the account line and the category overflow.
Note that `CategoryRail` *reduces* exposure — the most frequently opened Select in the app becomes
a row of chips.

This is scoped as its own debugging task with a real reproduction, not fixed blind here.

## 8 · Out of scope

- UX-12's quiet fee line on `/transactions` and in the edit dialog — compact only for now.
- UX-08 bottom-nav rework.
- "Guardar y añadir otro".
