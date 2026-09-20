# Papel Moneda — Phase 3: Transactions & Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skill:** every UI task runs under `/impeccable` (`.claude/skills/impeccable`). Load `reference/craft-floor.md` before editing UI. The composition for this phase is fixed by Task 14 of the master plan and the "Locked composition" below — do not re-run concept-seed.

**Goal:** Move the Transactions ledger, the transaction form and quick-add, the statement-import dialog, and the import triage screen onto the Papel Moneda primitives, per Task 14 of the master redesign plan.

**Architecture:** No new primitive family. The Phase 0/2 primitives (`LedgerRow`, `Stamp`, `ProofMark`, `SpecimenFrame`, `Card` as the Sheet) are recomposed into these screens. Three small pieces of net-new logic are added under TDD and kept pure: `amountDisplay` and `groupLedger` (`lib/transactions/display.ts`) replace logic that lives inline in `transaction-row.tsx` and `ledger.tsx`; `sheetRows` (`lib/statements/sheet-rows.ts`) turns the already-parsed statement JSON the import dialog holds into the rows of its "sheet being read". `LedgerRow` gains one optional `trailing` slot and `ProofMark` one `size` prop. No query, server action, route or schema changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn on `@base-ui/react`, next-intl, Vitest.

**Spec:** `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md` Task 14 (line ~1515) is the binding scope, file list and acceptance criteria; this plan argues from it. `DESIGN.md` is the visual system. `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` is the original brief (§6 "Transactions", "Imports triage").

## Locked composition

**Transactions page** (no Note): page header → filter block (unchanged behaviour) → per month a `legend` heading over a heavy rule → per day a **sticky date rule** (`legend` date + full-width `--rule` line) → `LedgerRow`s (Stamp lead, title with inline marks, account subtitle, tabular amount with sign glyph, always-visible edit/delete).

**Row amount:** income prints `+` in `--teal`; expense prints `−` (U+2212) in ink; a statement credit (refund) prints `+` in `--teal`; a payment prints no sign. The sign glyph carries the state; the colour only reinforces it.

**Category rail:** a horizontal strip of Stamps, each with its name printed under it; the selected one has a heavier ring and a thick underline rule (not colour). Shared by the form and triage.

**Form / quick-add:** already paper slips (`perforated-top` in `DialogContent`) with baseline inputs from Phase 0. This phase replaces what is still boxed: the type segmented control becomes a ruled tab strip, the summary lines lose their pill/link styling, dialog titles print as `legend`.

**Import dialog:** the section blocks become ruled statement sheets. While the file is being read the dialog shows unprinted ruled paper; when the parse returns, the sheet fills row by row with the statement's **real** lines (first 8 per section, then "y N líneas más"), using the marketing `statement-specimen` motion grammar (scan then print). No specimen data.

**Triage:** one `Card` as the sheet; each merchant group is a ledger block (heading `LedgerRow` + stamp rail, heavy rule between blocks). Finishing stamps a large `ProofMark ok` across the sheet once (reduced-motion safe); the existing `playSuccess` (already the stamp sound) is the sound.

## Global Constraints

- One family: Archivo (`wdth` axis) already global — no font work.
- Tokens are already global (`app/globals.css`, `design/tokens.json`) — this phase never edits a colour value; it only changes which component reads which token. Tokens used: `--ink`, `--ink-soft`, `--paper-line`, `--rule`, `--teal`, `--red`.
- **No Note on any screen in this phase.**
- State is a glyph, rule weight or ink density, never colour alone. Income `+`/expense `−` are text glyphs; selected category is a heavier ring + underline; done is a `ProofMark`.
- Category and account colour is user data — always through `Stamp` (which computes a safe ink per theme); never set text in the user's hex.
- WCAG 2.2 AA: 4.5:1 body text, keyboard-complete, visible 2px `currentColor` focus outline on every new interactive element, `prefers-reduced-motion` honoured (animations defined only under `no-preference`, so reduce = the finished static state).
- i18n: no hardcoded copy; `messages/en.json` and `messages/es.json` change together in every task that adds a key; bank terms stay Spanish in both. Existing keys are never renamed or removed.
- Must remain untouched: routes, queries, server actions, keyset paging and request-id guard in `ledger.tsx`, `router.refresh()` flows, the sound system, figure masking (`MaskedMoney` stays on income figures only), quick-add behaviour, checksum refusals, every guard listed in the master brief.
- Density: a transaction row is ≤ 56px tall at 360px; at 360×780 with the page scrolled past its header, at least 9 rows are fully visible.
- Help guide upkeep: the `/help` Transactions and Imports chapters and their mocks (`LedgerMock`, `TriageMock`), plus `Help.*` keys in both languages, change in this phase (Task 8), not later.
- A dev server, when started for a screenshot round, runs on a fixed port via `run_in_background`, needs `NODE_OPTIONS=--max-old-space-size=6144`, requires the user's confirmation first, and is stopped in the same turn; run `agent-browser close` for the named session.
- Branch: `redesign/papel-ledger`. Merge to `main` and delete the branch (local + remote) when Task 9 ships. Do **not** create a git worktree without asking.
- Each commit message ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017XHSrgH1cXeZkkFVgh8vNN
  ```
- Verification uses `git --no-pager` (RTK mangles git output; see `rtk proxy` if a result looks wrong).

## File Structure

**Create:**
- `lib/transactions/display.ts` (+ `display.test.ts`) — `amountDisplay`, `groupLedger`.
- `lib/statements/sheet-rows.ts` (+ `sheet-rows.test.ts`) — `sheetRows`.
- `components/transactions/date-rule.tsx` — the sticky date rule and month legend.
- `components/statements/statement-sheet.tsx` — `StatementSheet` (filled) and `ReadingSheet` (unprinted).
- `components/imports/done-stamp.tsx` — the large one-shot `ProofMark ok`.
- `components/papel/ledger-row.test.tsx`, `components/papel/proof-mark.test.tsx`, `components/transactions/category-rail.test.tsx`.

**Modify:**
- `components/papel/ledger-row.tsx` (`trailing` slot), `components/papel/proof-mark.tsx` (`size`).
- `components/transactions/{transaction-row,ledger,category-rail,transaction-form,transaction-dialog,account-date-line,fee-summary-line}.tsx`, `app/(app)/transactions/loading.tsx`.
- `components/quick-add/quick-add-dialog.tsx`.
- `components/statements/{statement-import-dialog,import-card-stub-step}.tsx`.
- `components/imports/triage-list.tsx`, `app/(app)/imports/[id]/page.tsx`, `app/(app)/imports/[id]/loading.tsx`.
- `app/globals.css` — `.stamp-inked`, `.sheet-row`, `.stamp-down` (all motion under `no-preference`).
- `components/help/mocks.tsx` (`LedgerMock`, `TriageMock`), `app/(app)/help/page.tsx`, `messages/en.json`, `messages/es.json`, `DESIGN.md`.

**Keep unchanged:** `components/transactions/fee-summary-line.tsx` logic, `components/accounts/account-activity.tsx` (it renders `TransactionRow`, so it restyles for free — confirm visually), `components/quick-add/{quick-add-button,quick-add-provider,quick-add-dialog-lazy}.tsx`, every `actions.ts`.

## Interfaces summary

- `amountDisplay(txn: AmountTxn, viewAccountId?: string)` → `{ value: number; currency: string; sign: "+" | "−" | ""; income: boolean }` — `value` is always a non-negative magnitude (Task 1).
- `groupLedger<T extends { occurred_at: string }>(rows: T[], monthLabel: (year: number, month: number) => string)` → `{ monthKey: string; label: string; days: { day: string; rows: T[] }[] }[]` (Task 1).
- `<LedgerRow … trailing?: React.ReactNode />` — rendered after the amount column (Task 2).
- `<DateRule day label sticky? />`, `<MonthLegend label />` (Task 3).
- `<CategoryRail categories value onChange onMore />` — props unchanged (Task 4).
- `<ProofMark tone size?: "sm" | "lg" />` (Task 7).
- `sheetRows(parsedStatement: string | null, sectionKey: string, limit: number)` → `{ rows: SheetRow[]; more: number }` (Task 6).

---

### Task 1: Pure display logic — `amountDisplay` and `groupLedger`

**Files:**
- Create: `lib/transactions/display.ts`, `lib/transactions/display.test.ts`

**Interfaces:**
- Produces: `amountDisplay`, `groupLedger`, `AmountTxn` (Tasks 2 and 3 consume).

- [ ] **Step 1: Write the failing test**

```ts
// lib/transactions/display.test.ts
import { describe, it, expect } from "vitest";
import { amountDisplay, groupLedger, type AmountTxn } from "./display";

const base: AmountTxn = {
  type: "expense",
  amount: 100,
  total_amount: 118,
  to_amount: null,
  currency: "DOP",
  statement_line_id: null,
  to_account_id: null,
  to_account: null,
};
const t = (over: Partial<AmountTxn>): AmountTxn => ({ ...base, ...over });

describe("amountDisplay", () => {
  it("prints an expense as a minus over the full cost", () => {
    expect(amountDisplay(t({}))).toEqual({ value: 118, currency: "DOP", sign: "−", income: false });
  });

  it("prints income as a plus, on the amount (not total)", () => {
    expect(amountDisplay(t({ type: "income" }))).toEqual({ value: 100, currency: "DOP", sign: "+", income: true });
  });

  it("prints a negative statement expense (refund) as a plus", () => {
    const r = amountDisplay(t({ statement_line_id: "l1", total_amount: -40 }));
    expect(r).toEqual({ value: 40, currency: "DOP", sign: "+", income: true });
  });

  it("prints a payment without a sign", () => {
    const r = amountDisplay(t({ type: "payment", total_amount: 300 }));
    expect(r).toEqual({ value: 300, currency: "DOP", sign: "", income: false });
  });

  it("switches a payment to its destination leg on the receiving account's page", () => {
    const r = amountDisplay(
      t({ type: "payment", to_amount: 5, to_account_id: "dst", to_account: { currency: "USD" } }),
      "dst",
    );
    expect(r).toEqual({ value: 5, currency: "USD", sign: "", income: false });
  });

  it("keeps the source leg on the source account's page", () => {
    const r = amountDisplay(
      t({ type: "payment", total_amount: 300, to_amount: 5, to_account_id: "dst", to_account: { currency: "USD" } }),
      "src",
    );
    expect(r.value).toBe(300);
    expect(r.currency).toBe("DOP");
  });
});

describe("groupLedger", () => {
  const rows = [
    { id: "a", occurred_at: "2026-09-04T00:00:00.000Z" },
    { id: "b", occurred_at: "2026-09-04T00:00:00.000Z" },
    { id: "c", occurred_at: "2026-09-02T00:00:00.000Z" },
    { id: "d", occurred_at: "2026-08-30T00:00:00.000Z" },
  ];
  const label = (y: number, m: number) => `${y}-${m}`;

  it("groups by month, then by day, preserving order", () => {
    const g = groupLedger(rows, label);
    expect(g.map((m) => m.monthKey)).toEqual(["2026-09", "2026-08"]);
    expect(g[0].label).toBe("2026-9");
    expect(g[0].days.map((d) => d.day)).toEqual(["2026-09-04", "2026-09-02"]);
    expect(g[0].days[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(g[1].days[0].day).toBe("2026-08-30");
  });

  it("returns nothing for no rows", () => {
    expect(groupLedger([], label)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/transactions/display.test.ts`
Expected: FAIL — `Cannot find module './display'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/transactions/display.ts
import type { TransactionWithRefs } from "./queries";

/** The fields `amountDisplay` reads — a structural slice so tests need not
 *  build a whole joined row. */
export type AmountTxn = Pick<
  TransactionWithRefs,
  "type" | "amount" | "total_amount" | "to_amount" | "currency" | "statement_line_id" | "to_account_id"
> & { to_account: { currency: string } | null };

export type AmountDisplay = {
  /** Always a non-negative magnitude; the sign is printed separately. */
  value: number;
  currency: string;
  sign: "+" | "−" | "";
  /** Money arriving. Only these figures go through the figure mask. */
  income: boolean;
};

/**
 * What a ledger row prints as its figure. A statement-sourced expense can be
 * negative (refund, rebate, reversal), which arrives as money in. A payment
 * seen from its destination account shows the destination leg, or a
 * cross-currency payment would show the wrong currency's number there.
 */
export function amountDisplay(txn: AmountTxn, viewAccountId?: string): AmountDisplay {
  const isStatementCredit =
    txn.type === "expense" && !!txn.statement_line_id && Number(txn.total_amount) < 0;
  if (isStatementCredit) {
    return { value: Math.abs(txn.total_amount), currency: txn.currency, sign: "+", income: true };
  }
  if (txn.type === "income") {
    return { value: Math.abs(txn.amount), currency: txn.currency, sign: "+", income: true };
  }
  if (txn.type === "expense") {
    return { value: Math.abs(txn.total_amount), currency: txn.currency, sign: "−", income: false };
  }
  const isDestinationLeg = viewAccountId != null && txn.to_account_id === viewAccountId;
  return {
    value: Math.abs(isDestinationLeg ? (txn.to_amount ?? txn.amount) : txn.total_amount),
    currency: isDestinationLeg ? (txn.to_account?.currency ?? txn.currency) : txn.currency,
    sign: "",
    income: false,
  };
}

/**
 * Month → day → rows. `occurred_at` is a calendar date stored as UTC
 * midnight, so the day key is read in UTC. Relies on the ledger arriving
 * sorted by date (same-month days contiguous), exactly as the inline version
 * in `ledger.tsx` did.
 */
export function groupLedger<T extends { occurred_at: string }>(
  rows: T[],
  monthLabel: (year: number, month: number) => string,
): { monthKey: string; label: string; days: { day: string; rows: T[] }[] }[] {
  const months = new Map<string, Map<string, T[]>>();
  for (const r of rows) {
    const day = new Date(r.occurred_at).toISOString().slice(0, 10);
    const monthKey = day.slice(0, 7);
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const days = months.get(monthKey)!;
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(r);
  }
  return [...months.entries()].map(([monthKey, days]) => {
    const [y, m] = monthKey.split("-").map(Number);
    return {
      monthKey,
      label: monthLabel(y, m),
      days: [...days.entries()].map(([day, dayRows]) => ({ day, rows: dayRows })),
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/transactions/display.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/transactions/display.ts lib/transactions/display.test.ts
git commit -m "feat(transactions): pure amountDisplay and groupLedger helpers"
```

(Append the attribution lines from Global Constraints to every commit message in this plan.)

---

### Task 2: `TransactionRow` onto `LedgerRow`

**Files:**
- Modify: `components/papel/ledger-row.tsx`, `components/transactions/transaction-row.tsx`
- Create: `components/papel/ledger-row.test.tsx`

**Interfaces:**
- Consumes: `amountDisplay` (Task 1); `LedgerRow`, `Stamp`.
- Produces: `LedgerRow`'s `trailing?: React.ReactNode` prop; the new `TransactionRow` (same props as today: `txn, data, onDelete, pending, viewAccountId?`).

- [ ] **Step 1: Write the failing test for the `trailing` slot**

```tsx
// components/papel/ledger-row.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LedgerRow } from "./ledger-row";

describe("LedgerRow trailing slot", () => {
  it("renders trailing content after the amount column", () => {
    const html = renderToStaticMarkup(
      <LedgerRow title="Colmado" amount="RD$ 10" trailing={<button data-x="act">edit</button>} />,
    );
    expect(html.indexOf("RD$ 10")).toBeLessThan(html.indexOf('data-x="act"'));
  });

  it("renders nothing extra without it", () => {
    expect(renderToStaticMarkup(<LedgerRow title="Colmado" />)).not.toContain("data-x");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/papel/ledger-row.test.tsx`
Expected: FAIL — first test: `indexOf` of the button is `-1` (prop ignored / passed to the div).

- [ ] **Step 3: Add the slot to `LedgerRow`**

In `components/papel/ledger-row.tsx`, add `trailing` to the destructured props and the prop type, and render it after the amount block:

```tsx
  wrapSubtitle,
  trailing,
  className,
  ...props
}: {
  ...
  /** Let the subtitle wrap instead of truncating (default: truncate). */
  wrapSubtitle?: boolean;
  /** Controls that live at the row's end (edit/delete). Not part of the figure column. */
  trailing?: React.ReactNode;
} & Omit<React.ComponentProps<"div">, "title">) {
```

and, immediately after the closing `) : null}` of the amount/meta block:

```tsx
      {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/papel/ledger-row.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rewrite `TransactionRow`**

Replace the body of `components/transactions/transaction-row.tsx`. Keep the `TYPE_ICON`, `TOUCH_TARGET` constants, title/subtitle derivation, the `isStatementCredit` derivation (still needed for the refund mark), and both `TransactionDialog`/delete buttons exactly as they are; change only the shell and figure:

```tsx
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Pencil, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { amountDisplay } from "@/lib/transactions/display";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "@/components/ui/button";
import { LedgerRow } from "@/components/papel/ledger-row";
import { Stamp } from "@/components/papel/stamp";
import { MaskedMoney } from "@/components/figure-mask/masked-money";
import { cn } from "@/lib/utils";

/** A printed micro-tag: engraved caps in a hairline frame, never a filled pill. */
function Mark({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="legend inline-flex shrink-0 items-center gap-1 rounded-[2px] border border-(--ink-soft) px-1 py-px text-[9px] leading-none text-muted-foreground"
    >
      {children}
    </span>
  );
}

// ... TYPE_ICON and TOUCH_TARGET unchanged ...

export function TransactionRow(/* props unchanged */) {
  // ... t, tType, Icon, category, account, toAccount, title, subtitle unchanged ...
  const isStatementCredit =
    txn.type === "expense" && !!txn.statement_line_id && Number(txn.total_amount) < 0;
  const amt = amountDisplay(txn, viewAccountId);
  const hasExtras = txn.tax_amount > 0 || txn.fee_amount > 0;

  const figure = (
    <span className={cn("text-sm font-semibold", amt.income ? "text-(--teal)" : "text-foreground")}>
      {amt.sign}
      {amt.income ? (
        <MaskedMoney amount={amt.value} currency={amt.currency} />
      ) : (
        formatMoney(amt.value, amt.currency)
      )}
    </span>
  );

  return (
    <LedgerRow
      className="px-0 py-2.5"
      lead={<Stamp color={category?.color ?? null} emoji={category?.emoji} name={category?.name} icon={Icon} size="sm" />}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{title}</span>
          {txn.exclude_from_budget ? <Mark>{t("excludeFromBudgetBadge")}</Mark> : null}
          {txn.statement_line_id ? <Mark>{t("statementBadge")}</Mark> : null}
          {isStatementCredit ? <Mark>{t("refundBadge")}</Mark> : null}
          {txn.fx_fallback ? (
            <Mark title={t("fxFallbackWarning")}>
              <TriangleAlert aria-hidden className="size-2.5" />
              {t("fxFallbackBadge")}
            </Mark>
          ) : null}
        </span>
      }
      subtitle={subtitle}
      amount={figure}
      meta={hasExtras ? t("inclFees", { amount: formatMoney(txn.tax_amount + txn.fee_amount, txn.currency) }) : undefined}
      trailing={
        <>
          <TransactionDialog mode="edit" transaction={txn} data={data} trigger={/* the existing edit Button, unchanged */} />
          {/* the existing delete Button, unchanged */}
        </>
      }
    />
  );
}
```

Check `MaskedMoney`'s real props before use (`components/figure-mask/masked-money.tsx`); the old call passed `opts={{ signed }}` — drop `signed` since the sign is now printed separately, keep everything else it needs. The existing `hasExtras` text was `text-[11px]`; `LedgerRow`'s `meta` is `text-xs` — accepted. Remove the now-unused `Badge` and `ColorTile` imports and the `group` class (no hover-reveal remains).

- [ ] **Step 6: Typecheck, lint, run tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run components/papel lib/transactions`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/papel/ledger-row.tsx components/papel/ledger-row.test.tsx components/transactions/transaction-row.tsx
git commit -m "feat(transactions): rows print as ledger lines with a sign glyph and stamp lead"
```

---

### Task 3: The ledger — sticky date rules and ruled skeleton

**Files:**
- Create: `components/transactions/date-rule.tsx`
- Modify: `components/transactions/ledger.tsx`, `app/(app)/transactions/loading.tsx`

**Interfaces:**
- Consumes: `groupLedger` (Task 1), new `TransactionRow` (Task 2).
- Produces: `DateRule({ label })`, `MonthLegend({ label })`.

- [ ] **Step 1: Create the date-rule components**

```tsx
// components/transactions/date-rule.tsx
import { cn } from "@/lib/utils";

/** A month's heading: engraved caps over a heavy rule. Not sticky — the day
 *  rule below it is what stays pinned. */
export function MonthLegend({ label }: { label: string }) {
  return (
    <h2 className="legend border-b-2 border-(--rule) pb-1.5 text-[11px] text-foreground">{label}</h2>
  );
}

/** The date a run of rows shares: an engraved date over a full-width rule.
 *  Sticky under the mobile header (top-14) and at the top on desktop; the
 *  page background keeps rows from showing through it. */
export function DateRule({ label, className }: { label: string; className?: string }) {
  return (
    <h3
      className={cn(
        "legend sticky top-14 z-10 border-b border-(--rule) bg-background py-1.5 text-[10px] text-muted-foreground md:top-0",
        className,
      )}
    >
      {label}
    </h3>
  );
}
```

Confirm `bg-background` is the page paper token (see `app/globals.css`); if the page surface uses a different token, use that one.

- [ ] **Step 2: Rewire `ledger.tsx`**

Make exactly these edits (leave all fetching, paging, filter and request-id logic untouched):

1. Replace the `dayFormatter` constant with a locale-aware one built inside the component:
   ```ts
   const dayFormatter = useMemo(
     () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
     [locale],
   );
   ```
   (The old formatter was hard-coded `en-US`; the app is Spanish-first. Keep `timeZone: "UTC"` and its comment.)
2. Replace the `byDay` and `byMonth` memos with:
   ```ts
   const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
   const grouped = useMemo(
     () => groupLedger(rows, (y, m) => monthFormatter.format(new Date(y, m - 1, 1))),
     [rows, monthFormatter],
   );
   ```
   Delete the `TransactionWithRefs` import if it becomes unused.
3. Replace the `byMonth.map(...)` block in the JSX with:
   ```tsx
   <div className={loading ? "space-y-8 opacity-60 transition-opacity" : "space-y-8"}>
     {grouped.map(({ monthKey, label, days }) => (
       <section key={monthKey} className="space-y-3">
         <MonthLegend label={label} />
         {days.map(({ day, rows: rowsOfDay }) => (
           <div key={day}>
             <DateRule label={dayFormatter.format(new Date(day))} />
             {rowsOfDay.map((txn) => (
               <TransactionRow key={txn.id} txn={txn} data={data} onDelete={onDelete} pending={pending} />
             ))}
           </div>
         ))}
       </section>
     ))}
   </div>
   ```
   The rows now carry their own hairline (`LedgerRow`'s `border-b`), so the old `divide-y` wrapper is gone.
4. Loading text and the end-of-ledger line stay. The empty state keeps `EmptyState`.

- [ ] **Step 3: Ruled skeleton**

Rewrite `app/(app)/transactions/loading.tsx` so the skeleton is unprinted ruled paper, no rounded blocks: keep the header and filter skeletons, and replace the day/row skeletons with:

```tsx
      <div className="space-y-8">
        {[0, 1].map((month) => (
          <div key={month} className="space-y-3">
            <div className="skeleton h-3 w-28 rounded-none" />
            <div className="border-t-2 border-(--rule)" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 border-b border-(--paper-line) py-2.5">
                <div className="skeleton size-9 rounded-full" />
                <div className="skeleton h-4 flex-1 rounded-none" />
                <div className="skeleton h-4 w-16 rounded-none" />
              </div>
            ))}
          </div>
        ))}
      </div>
```

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run lib/transactions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/transactions/date-rule.tsx components/transactions/ledger.tsx "app/(app)/transactions/loading.tsx"
git commit -m "feat(transactions): ledger under sticky date rules with a ruled skeleton"
```

Visual acceptance (checked in Task 9): row height ≤ 56px; ≥ 9 rows visible at 360×780 scrolled; a 60-character merchant truncates with its marks still visible; a two-currency day aligns amounts on the right edge.

---

### Task 4: `CategoryRail` as a strip of Stamps

**Files:**
- Modify: `components/transactions/category-rail.tsx`, `app/globals.css`
- Create: `components/transactions/category-rail.test.tsx`

**Interfaces:**
- Consumes: `Stamp`.
- Produces: `CategoryRail` — **props unchanged** (`categories, value, onChange, onMore`) so `transaction-form.tsx` and `triage-list.tsx` need no edits.

- [ ] **Step 1: Write the failing test**

```tsx
// components/transactions/category-rail.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { CategoryRail } from "./category-rail";

const cats = [
  { id: "a", name: "Comida", emoji: "🍽️", color: "#0E6E60", budget_group_id: null },
  { id: "b", name: "Transporte", emoji: null, color: "#1D4FB8", budget_group_id: null },
];
const html = (value: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={{ TransactionForm: { categoryLabel: "Categoría", moreCategories: "Más…" } }}>
      <CategoryRail categories={cats as never} value={value} onChange={() => {}} onMore={() => {}} />
    </NextIntlClientProvider>,
  );

describe("CategoryRail", () => {
  it("is a radiogroup of stamps, one radio per category", () => {
    const out = html("");
    expect(out).toContain('role="radiogroup"');
    expect(out.match(/role="radio"/g)).toHaveLength(2);
    expect(out).toContain("stamp");
  });

  it("marks only the chosen category checked and inked", () => {
    const out = html("b");
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/stamp-inked/g)).toHaveLength(1);
  });

  it("keeps the more control", () => {
    expect(html("")).toContain("Más…");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/transactions/category-rail.test.tsx`
Expected: FAIL — no `stamp-inked`; markup has the chip buttons, not Stamps.

- [ ] **Step 3: Add the `.stamp-inked` utility**

In `app/globals.css`, inside the existing `@layer components` block next to `.stamp`, add:

```css
  /* A stamp pressed harder: the selected state on a category rail. The heavier
     ring plus the underline on its button is the state, not colour. */
  .stamp.stamp-inked {
    border-width: 3px;
  }
```

- [ ] **Step 4: Rewrite the rail's markup**

Keep the file's header comment, `VISIBLE`, `selectedOffRail` logic, props and the radiogroup wrapper. Replace the mapped chips and the "more" button:

```tsx
import { Ellipsis } from "lucide-react";
import { Stamp } from "@/components/papel/stamp";
// ...
    <div
      className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1 pb-1"
      role="radiogroup"
      aria-label={t("categoryLabel")}
    >
      {[...(selectedOffRail ? [selectedOffRail] : []), ...shown].map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={c.name}
            onClick={() => onChange(c.id)}
            className={cn(
              "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 border-b-[3px] pb-1 pt-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
              on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Stamp color={c.color} emoji={c.emoji} name={c.name} size="sm" className={on ? "stamp-inked" : undefined} />
            <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{c.name}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1 border-b-[3px] border-transparent pb-1 pt-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-(--ink-soft)">
          <Ellipsis aria-hidden className="size-[18px]" />
        </span>
        <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{t("moreCategories")}</span>
      </button>
    </div>
```

`w-[3.25rem]` × 6 + `gap-0.5` fits the 360px dialog's 328px content width without the strip needing to scroll; longer names truncate (full name in `title` and in the DOM for the radio's accessible name). `Ellipsis` — confirm the icon name exists in the installed `lucide-react`; else `MoreHorizontal`.

- [ ] **Step 5: Run the test, typecheck, lint**

Run: `npx vitest run components/transactions/category-rail.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/transactions/category-rail.tsx components/transactions/category-rail.test.tsx app/globals.css
git commit -m "feat(transactions): category rail is a strip of ink stamps"
```

---

### Task 5: Form and quick-add as paper slips

**Files:**
- Modify: `components/transactions/{transaction-form,transaction-dialog,account-date-line,fee-summary-line}.tsx`, `components/quick-add/quick-add-dialog.tsx`

`DialogContent` is already a perforated paper slip and `Input` a baseline field (Phase 0). This task restyles only what is still boxed. No logic changes.

- [ ] **Step 1: Ruled tab strip for the type control**

In `transaction-form.tsx`, replace the segmented control (`grid grid-cols-3 gap-1 rounded-lg bg-muted p-1` and its buttons) with:

```tsx
          <div role="radiogroup" aria-label={t("typeLabel")} className="grid grid-cols-3 border-b border-(--rule)">
            {TRANSACTION_TYPES.map((tt) => (
              <button
                key={tt}
                type="button"
                role="radio"
                aria-checked={field.value === tt}
                disabled={fromStatement}
                onClick={() => field.onChange(tt)}
                className={cn(
                  "legend -mb-px border-b-[3px] px-2 py-2.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current",
                  field.value === tt
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  fromStatement && "cursor-not-allowed opacity-60",
                )}
              >
                {tType(tt)}
              </button>
            ))}
          </div>
```

`t("typeLabel")` is a new key — add `TransactionForm.typeLabel` ("Tipo" / "Type") to both message files. The map variable is renamed from `t` to `tt` because the original shadowed the translator inside the callback.

- [ ] **Step 2: Remove remaining boxed chrome in the form**

Run: `rg -n "rounded-lg|bg-muted|border-input|rounded-full" components/transactions/transaction-form.tsx components/transactions/account-date-line.tsx components/transactions/fee-summary-line.tsx`
For each hit that is a box around a control or a pill (not a switch or a focus ring), restyle to a hairline rule: `rounded-lg border` → `border-y border-(--paper-line)`; `bg-muted` fills → none. Do not touch `Switch`/`Select` internals (they are Phase 0's).

- [ ] **Step 3: Summary lines**

`account-date-line.tsx`: change the button classes to `flex w-full items-center gap-1.5 border-y border-(--paper-line) py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current` (drop `rounded-md`, `self-start`, the underline hover). `fee-summary-line.tsx`: `text-primary underline-offset-2 hover:underline focus-visible:ring-3 …` → `text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`.

- [ ] **Step 4: Dialog titles print as legends**

In `transaction-dialog.tsx` and `quick-add-dialog.tsx`, change `<DialogTitle className="text-xl">` to `<DialogTitle className="legend text-sm">`. Also change the same in `components/statements/statement-import-dialog.tsx`'s `<DialogTitle>` (currently unclassed) so the three slips share one title voice.

- [ ] **Step 5: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run lib/transactions`
Expected: PASS (the form's pure logic tests are unaffected).

- [ ] **Step 6: Commit**

```bash
git add components/transactions components/quick-add messages/en.json messages/es.json components/statements/statement-import-dialog.tsx
git commit -m "style(transactions): form and quick-add print as slips with a ruled type strip"
```

Visual acceptance (Task 9): the compact quick-add at 360×780 needs no scroll to reach the save button with the keyboard closed; the rail, amount, summary line and save all read as one slip.

---

### Task 6: Import dialog — the statement read as a ruled sheet

**Files:**
- Create: `lib/statements/sheet-rows.ts`, `lib/statements/sheet-rows.test.ts`, `components/statements/statement-sheet.tsx`
- Modify: `components/statements/statement-import-dialog.tsx`, `components/statements/import-card-stub-step.tsx`, `app/globals.css`, `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: the `parsedStatement` JSON string the dialog already holds in state (`ParsedStatement` from `lib/statements/types.ts`).
- Produces: `sheetRows`, `SheetRow`, `<StatementSheet …>`, `<ReadingSheet fileName />`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/statements/sheet-rows.test.ts
import { describe, it, expect } from "vitest";
import { sheetRows } from "./sheet-rows";

const line = (lineNo: number, amountCents: number, madeOn = "2026-09-05") => ({
  lineNo, madeOn, postedOn: madeOn, reference: null, description: `LINE ${lineNo}`,
  mcc: null, authCode: null, amountCents, kind: amountCents < 0 ? "credit" : "purchase", suggestedCategory: null,
});
const stmt = JSON.stringify({
  parserId: "p", cardLast4: "4417",
  sections: [
    { sectionKey: "DOP", currency: "DOP", lines: [line(1, 438210), line(2, -5000, "2026-09-06"), line(3, 100), line(4, 200)] },
    { sectionKey: "USD", currency: "USD", lines: [line(9, 1549)] },
  ],
});

describe("sheetRows", () => {
  it("returns the section's real lines, newest data untouched, limited", () => {
    const { rows, more } = sheetRows(stmt, "DOP", 2);
    expect(rows).toHaveLength(2);
    expect(more).toBe(2);
    expect(rows[0]).toEqual({ key: "DOP-1", date: "05/09", text: "LINE 1", amount: 4382.1, credit: false });
  });

  it("marks a negative line as a credit with a positive magnitude", () => {
    const { rows } = sheetRows(stmt, "DOP", 8);
    expect(rows[1]).toMatchObject({ amount: 50, credit: true, date: "06/09" });
    expect(sheetRows(stmt, "DOP", 8).more).toBe(0);
  });

  it("only reads the requested section", () => {
    expect(sheetRows(stmt, "USD", 8).rows.map((r) => r.key)).toEqual(["USD-9"]);
  });

  it("degrades to nothing for null, malformed or unknown input", () => {
    expect(sheetRows(null, "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows("{nope", "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows(stmt, "EUR", 8)).toEqual({ rows: [], more: 0 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/statements/sheet-rows.test.ts`
Expected: FAIL — `Cannot find module './sheet-rows'`.

- [ ] **Step 3: Implement `sheetRows`**

```ts
// lib/statements/sheet-rows.ts
import type { ParsedStatement } from "./types";

export type SheetRow = {
  key: string;
  /** `DD/MM`, as the statement prints it. */
  date: string;
  /** The bank's own text, untouched. */
  text: string;
  /** A non-negative magnitude in the section's currency. */
  amount: number;
  /** A negative line: money back to the card. */
  credit: boolean;
};

/**
 * The first `limit` real lines of one section of the statement the dialog has
 * already parsed, plus how many were left off. Reads the JSON the client
 * echoes back on confirm, so no request is needed and no figure is invented.
 * Anything unreadable degrades to an empty sheet rather than throwing inside
 * a dialog.
 */
export function sheetRows(
  parsedStatement: string | null,
  sectionKey: string,
  limit: number,
): { rows: SheetRow[]; more: number } {
  if (!parsedStatement) return { rows: [], more: 0 };
  let parsed: ParsedStatement;
  try {
    parsed = JSON.parse(parsedStatement) as ParsedStatement;
  } catch {
    return { rows: [], more: 0 };
  }
  const section = parsed.sections?.find((s) => s.sectionKey === sectionKey);
  if (!section?.lines) return { rows: [], more: 0 };
  const rows = section.lines.slice(0, limit).map((l) => ({
    key: `${sectionKey}-${l.lineNo}`,
    date: `${l.madeOn.slice(8, 10)}/${l.madeOn.slice(5, 7)}`,
    text: l.description,
    amount: Math.abs(l.amountCents) / 100,
    credit: l.amountCents < 0,
  }));
  return { rows, more: Math.max(0, section.lines.length - rows.length) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/statements/sheet-rows.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the motion (global, real-rows-only, reduce-safe)**

Inside the existing `@media (prefers-reduced-motion: no-preference)` block in `app/globals.css` (starts ~line 482), add. Under `reduce` these rules do not exist, so rows simply render finished:

```css
  /* The statement being read: each real line is scanned, then printed. Only
     the first dozen animate; a 100-line statement must not take 40 seconds. */
  .sheet-row {
    animation: sheet-print 520ms var(--ease-press, ease-out) both;
    animation-delay: calc(min(var(--i, 0), 11) * 90ms);
  }
  @keyframes sheet-print {
    from {
      clip-path: inset(0 100% 0 0);
      opacity: 0.2;
      background: color-mix(in oklab, var(--stamp-light, var(--ink)) 18%, transparent);
    }
    to {
      clip-path: inset(0 0 0 0);
      opacity: 1;
      background: transparent;
    }
  }
```

(`--ease-press` is used by the marketing module; if it is not a global token, use `ease-out`.)

- [ ] **Step 6: Add the sheet components**

```tsx
// components/statements/statement-sheet.tsx
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SheetRow } from "@/lib/statements/sheet-rows";

/** A statement read line by line: ruled paper, the bank's own text, the
 *  amount at the right, credits as a plus. Rows carry `--i` so the global
 *  `.sheet-row` motion can stagger them. */
export function StatementSheet({
  rows,
  more,
  currency,
}: {
  rows: SheetRow[];
  more: number;
  currency: string;
}) {
  const t = useTranslations("Statements");
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <ol aria-label={t("sheetLabel")} className="border-y border-(--paper-line)">
        {rows.map((r, i) => (
          <li
            key={r.key}
            style={{ "--i": i } as React.CSSProperties}
            className="sheet-row grid grid-cols-[2.6rem_1fr_auto] items-baseline gap-2 border-b border-(--paper-line) px-1 py-1.5 text-xs last:border-b-0"
          >
            <span className="figure text-muted-foreground">{r.date}</span>
            <span className="truncate uppercase tracking-wide">{r.text}</span>
            <span className={cn("figure font-semibold", r.credit && "text-(--teal)")}>
              {r.credit ? "+" : ""}
              {formatMoney(r.amount, currency)}
            </span>
          </li>
        ))}
      </ol>
      {more > 0 ? <p className="mt-1 text-xs text-muted-foreground">{t("sheetMore", { count: more })}</p> : null}
    </div>
  );
}

/** Unprinted ruled paper while the file is being read. The rows are empty
 *  rules with one sweeping highlight, never placeholder figures. */
export function ReadingSheet({ fileName }: { fileName: string }) {
  const t = useTranslations("Statements");
  return (
    <div className="min-w-0 space-y-2" role="status">
      <p className="truncate text-sm font-medium">{t("readingSheet", { fileName })}</p>
      <div aria-hidden className="border-y border-(--paper-line)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-7 rounded-none border-b border-(--paper-line) last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
```

Add `Statements.sheetLabel`, `Statements.sheetMore` ("y {count} líneas más" / "and {count} more lines"), `Statements.readingSheet` ("Leyendo {fileName}…" / "Reading {fileName}…") to both message files.

- [ ] **Step 7: Recompose the dialog body**

In `statement-import-dialog.tsx`:

1. Render `<ReadingSheet fileName={file.name} />` when `pending && file && !preview && !needsPassword`, immediately after the upload button block.
2. In each section block (`preview.sections.map`), change the wrapper `rounded-lg border p-3 space-y-2` to `min-w-0 space-y-2 border-t-2 border-(--rule) pt-3`. Print the head line as `legend text-[11px]` for `{s.sectionKey} · {s.currency}` and the period in muted text on the next line; keep the closing balance as `figure`.
3. Directly under the head, render `<StatementSheet {...sheetRows(parsedStatement, s.sectionKey, 8)} currency={s.currency} />` (spread as `rows`/`more` props). `parsedStatement` is the existing state variable.
4. Keep `sectionSummary`, the mapping `Select` and the unmatched/add-line block unchanged below it.
5. The "exclude from budget" row `rounded-lg border bg-muted/30 p-3` → `border-y border-(--paper-line) py-3`.
6. The card-picker buttons `rounded-lg border p-3 hover:bg-muted/50` → `border-b border-(--paper-line) px-1 py-3 hover:bg-muted/50`, and the skeleton `li`s `skeleton h-12 rounded-lg` → `skeleton h-12 rounded-none`.
7. `rg -n "rounded-lg" components/statements/import-card-stub-step.tsx` and restyle boxed containers there the same way (hairline rules, no rounded boxes).

- [ ] **Step 8: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run lib/statements`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/statements/sheet-rows.ts lib/statements/sheet-rows.test.ts components/statements app/globals.css messages/en.json messages/es.json
git commit -m "feat(imports): the statement import dialog reads the file as a ruled sheet"
```

---

### Task 7: Triage — ledger blocks and the finishing stamp

**Files:**
- Create: `components/imports/done-stamp.tsx`, `components/papel/proof-mark.test.tsx`
- Modify: `components/papel/proof-mark.tsx`, `components/imports/triage-list.tsx`, `app/(app)/imports/[id]/loading.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `CategoryRail` (Task 4), `LedgerRow`, `Card`, `ProofMark`, `useUiSound().playSuccess`.
- Produces: `ProofMark`'s `size?: "sm" | "lg"`; `<DoneStamp label />`.

- [ ] **Step 1: Write the failing test for `ProofMark` size**

```tsx
// components/papel/proof-mark.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProofMark } from "./proof-mark";

describe("ProofMark size", () => {
  it("defaults to the small mark", () => {
    expect(renderToStaticMarkup(<ProofMark tone="ok">Cuadra</ProofMark>)).toContain("size-4");
  });
  it("prints a large mark when asked", () => {
    const out = renderToStaticMarkup(<ProofMark tone="ok" size="lg">Listo</ProofMark>);
    expect(out).toContain("size-14");
    expect(out).not.toContain("size-4 ");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/papel/proof-mark.test.tsx`
Expected: FAIL on the `lg` case (no `size-14`).

- [ ] **Step 3: Implement `size`**

In `components/papel/proof-mark.tsx` add the prop (`size = "sm"`, type `"sm" | "lg"`), make the wrapper `gap-1.5` for `sm` / `flex-col gap-2` for `lg`, the text `text-xs` for `sm` / `legend text-sm` for `lg`, and the svg `size-4` for `sm` / `size-14` for `lg` (the svg class list must stay a plain string so the test can match; write `"size-4 shrink-0"` and `"size-14 shrink-0"`). Existing callers pass no size and are unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/papel/proof-mark.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the one-shot stamp motion**

In the `no-preference` block of `app/globals.css`:

```css
  /* Triage finished: the proof mark is stamped down once. */
  .stamp-down {
    animation: stamp-down 520ms var(--ease-press, cubic-bezier(0.2, 0.9, 0.3, 1.2)) both;
  }
  @keyframes stamp-down {
    from {
      opacity: 0;
      transform: scale(1.5) rotate(-10deg);
    }
    to {
      opacity: 1;
      transform: rotate(-4deg);
    }
  }
```

The static end state (used under reduce and for a triage that was already done on arrival) is set in the component as `-rotate-[4deg]`.

- [ ] **Step 6: The done stamp**

```tsx
// components/imports/done-stamp.tsx
import { ProofMark } from "@/components/papel/proof-mark";
import { cn } from "@/lib/utils";

/** The large check printed across a finished sheet. `animate` is true only on
 *  the transition into done; arriving at an already-finished triage shows the
 *  mark still, with no motion and no sound. */
export function DoneStamp({ label, animate }: { label: string; animate: boolean }) {
  return (
    <div className={cn("-rotate-[4deg]", animate && "stamp-down")}>
      <ProofMark tone="ok" size="lg">
        {label}
      </ProofMark>
    </div>
  );
}
```

- [ ] **Step 7: Recompose `triage-list.tsx`**

Make these edits; keep every handler and comment about `frozen`, `assign`, keyboard and the Base UI portal guard.

1. Imports: add `useRef`, `LedgerRow`, `DoneStamp`; drop `Card`'s per-group use (the `Card` is now the whole sheet); drop `MoneyDisplay` if `LedgerRow`'s figure replaces it.
2. Detect finishing during render (the same "reset state when a prop changes" shape as `ledger.tsx`):
   ```ts
   const [prevCount, setPrevCount] = useState(groups.length);
   const [justFinished, setJustFinished] = useState(false);
   if (groups.length !== prevCount) {
     setPrevCount(groups.length);
     if (prevCount > 0 && groups.length === 0) setJustFinished(true);
   }
   ```
3. Keep focus after an assignment removes the button that held it: add `const listRef = useRef<HTMLUListElement>(null);`, attach `ref={listRef}` to the `<ul>`, and in `assign`'s success branch call `listRef.current?.focus()` right after `router.refresh()`.
4. The empty (done) branch becomes a sheet with the stamp:
   ```tsx
   <Card className="items-center gap-4 p-8 text-center">
     <DoneStamp label={t("allDone")} animate={justFinished} />
     <p className="text-sm text-muted-foreground">{t("allDoneBody")}</p>
     {accountId ? (/* the existing outline Button + Link, unchanged */) : null}
   </Card>
   ```
   Do **not** add a second `playSuccess()` for the finish: the last assignment's existing `playSuccess()` (which is the stamp sound) is the finishing stamp, and a second play would double it.
5. The group list becomes one sheet of ledger blocks:
   ```tsx
   <Card className="gap-0 overflow-hidden p-0">
     <ul ref={listRef} className="focus-visible:outline-none" tabIndex={0} onKeyDown={onKeyDown}>
       {groups.map((group, i) => (
         <li
           key={group.key}
           className={cn(
             "border-b-2 border-(--rule) last:border-b-0",
             busyKey === group.key && "opacity-60",
             i === focusedIndex && "outline-2 -outline-offset-2 outline-current",
           )}
         >
           <LedgerRow
             className="px-4 pt-3"
             title={group.description}
             subtitle={`${t("groupLines", { count: group.count })} · ${t("groupDates", { from: formatDate(group.firstDate, locale), to: formatDate(group.lastDate, locale) })}`}
             amount={<span className="text-sm font-semibold">{formatMoney(group.total, group.currency)}</span>}
           />
           <div className="px-4 pb-3">
             {/* the existing expandedKey ? <Select…/> : <CategoryRail…/> block, unchanged */}
           </div>
         </li>
       ))}
     </ul>
   </Card>
   ```
   Add `import { formatMoney } from "@/lib/format"`. `LedgerRow` already truncates a long merchant name. The focus indicator is a 2px inset `currentColor` outline (the old `ring-2 ring-ring/50` is dropped).
6. The `<p className="text-sm text-muted-foreground">{summary}</p>` above stays as is.

Also update `app/(app)/imports/[id]/loading.tsx` so its skeleton is one ruled sheet (`border border-(--paper-line)` with heavy-rule-separated blocks of `skeleton rounded-none` lines), matching Task 3's skeleton treatment.

- [ ] **Step 8: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run components/papel lib/statements`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/papel/proof-mark.tsx components/papel/proof-mark.test.tsx components/imports app/globals.css "app/(app)/imports"
git commit -m "feat(imports): triage is a sheet of ledger blocks, finished with a stamped proof mark"
```

Acceptance (Task 9): keyboard-only flow — Tab into the list, ↑/↓ moves the outline, digits 1–9 assign, Tab reaches a rail then "more", assigning from a rail with Enter leaves focus on the list (not lost to the page), and the last assignment stamps the mark once. Reduced-motion: mark appears still.

---

### Task 8: Help guide and DESIGN.md

**Files:**
- Modify: `components/help/mocks.tsx` (`LedgerMock`, `TriageMock`), `app/(app)/help/page.tsx`, `messages/en.json`, `messages/es.json`, `DESIGN.md`

The mocks must match the real UI (help-guide-upkeep rule). Rebuild both from the same primitives inside a `SpecimenFrame`, with fixed made-up data, exactly as `AccountsMock` was done in Phase 2.

- [ ] **Step 1: `LedgerMock`**

Rebuild it as a `SpecimenFrame` containing a `DateRule`-style header (a static `legend` line + rule, not the sticky component) and three `LedgerRow`s that use `Stamp` leads and the real sign rules: groceries `−RD$…` in ink with the statement mark, paycheck `+` in `--teal`, payment with no sign. Import `LedgerRow`, `Stamp`, `SpecimenFrame`, and the `Mark` styling (extract `Mark` from `transaction-row.tsx` into `components/transactions/mark.tsx` and import it in both places rather than duplicating). Add one prop `dayLabel: string` and pass `t("ledgerMockDay")` from `help/page.tsx`. Keep the existing props and keys.

Add `Help.ledgerMockDay` to both files: en `"Fri, Sep 4"`, es `"vie, 4 sep"`.

- [ ] **Step 2: `TriageMock`**

Rebuild as a `SpecimenFrame` containing the frozen summary line and two ledger blocks (`LedgerRow` head + a static stamp rail of three `Stamp`s with names, the selected one `stamp-inked` with an underline) inside one hairline sheet, mirroring Task 7's structure. Keep the existing props and keys.

- [ ] **Step 3: Chapter copy**

Run: `rg -n "chip|pill|tile|badge|card" messages/en.json | rg -i "Help|triage|ledger|transaction"` and re-read the Help transactions chapter (`transactionsIntro`, `addingBody`, `findingBody`) and the Imports/triage copy. Wherever it describes the category picker as "chips", the ledger as "cards", or the import preview as a form, reword to match what the screen now shows (stamps, ruled rows, the sheet being read, the stamped mark at the end), in **both** languages. Do not remove keys.

- [ ] **Step 4: `DESIGN.md`**

Add a `### Transactions and Imports (Phase 3)` section after `### Accounts (Phase 2)` describing: the sign-glyph rule; sticky date rules; the stamp rail (`CategoryRail`, `stamp-inked`); the paper-slip form; the import sheet (`sheetRows` → `StatementSheet`, real rows only); the triage sheet and one-shot `DoneStamp`; and that no Note appears on these screens. Update the "Pending, not yet migrated" list: remove Transactions and Imports from it and update the alias caller counts (run `rg -l "ColorTile" --glob '*.tsx'` and `rg -l "StatPill" --glob '*.tsx'` and put the real numbers in). Update the "Structural pending"/primitives paragraph so it says Transactions and Imports (Phase 3) are the first screens to use `LedgerRow`'s `trailing` slot and `ProofMark`'s `lg` size.

- [ ] **Step 5: Typecheck, lint, tests, i18n parity**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: PASS. Also confirm every key added in Tasks 5–8 exists in both `messages/en.json` and `messages/es.json` (`node -e` to diff the key sets of the changed namespaces, or rely on the repo's existing i18n parity test if present).

- [ ] **Step 6: Commit**

```bash
git add components/help components/transactions/mark.tsx components/transactions/transaction-row.tsx "app/(app)/help/page.tsx" messages DESIGN.md
git commit -m "docs(help): Transactions and Imports chapters, mocks and DESIGN.md match the ledger"
```

---

### Task 9: Batched review, audit, polish, finish

**Files:** whatever the round finds.

This is the craft gate. Nothing is merged until the acceptance list below is verified against the running app, not against the code.

- [ ] **Step 1: Full local gate**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all PASS. Then `npm run build` (memory: Turbopack OOMs on the statement/pdfjs graph — run with `NODE_OPTIONS=--max-old-space-size=6144`).

- [ ] **Step 2: Ask before starting the dev server**

Ask the user to confirm starting the dev server (their standing rule). If they confirm: check `ss -ltnp | grep 3000` and `pgrep -af 'next dev'` first and reuse a running one; otherwise start one server, on port 3000, with `NODE_OPTIONS=--max-old-space-size=6144`, via `run_in_background`. Drive it with `agent-browser` and a named session from `agent-browser session id --scope worktree --prefix tywin`, using `--restore` for login (the remote Supabase has no seed users; see the `browser-verification-setup` memory for the fallback temp-route trick, which must be deleted before committing).

- [ ] **Step 3: Screenshot rounds (360×780 and 1440, light and dark)**

Capture: Transactions (populated, empty, filtered-empty, loading), the transaction dialog (create, edit), quick-add compact, the import dialog (card picker, reading sheet, filled sheet with a two-section statement), triage (several groups, expanded "more" picker, done state), an account detail page's activity list (it reuses `TransactionRow`), and `/help#transactions` and the Imports mock.

- [ ] **Step 4: Verify the acceptance criteria**

- A 60-character merchant name truncates cleanly, and its marks (statement, refund, FX) are still visible.
- A two-currency day's amounts align on the right edge.
- ≥ 9 rows fully visible at 360×780 with the page scrolled past its header; row height ≤ 56px.
- No Note on any screen in this phase; no `rounded-lg` boxes left on these screens (`rg -n "rounded-lg" components/transactions components/statements components/imports`).
- Income `+`/teal, expense `−`/ink, refund `+`/teal, payment unsigned — and every state still reads in greyscale.
- Near-white and near-black category colours stay legible as stamps in both themes.
- Keyboard-only triage flow works end to end as described in Task 7; visible 2px outline on the rail, type strip, summary lines, list.
- Reduced motion (emulate `prefers-reduced-motion: reduce`): the filled sheet and the done mark render finished, with no animation.
- The stamp sound plays once when the last group is categorised, and not at all when opening an already-finished triage.
- Figure masking on: income figures mask and keep their width; expense figures behave exactly as before.
- Locale: date rules print Spanish in `es`, English in `en`.

- [ ] **Step 5: Fix findings, one commit per fix**

For each defect, add a failing test where the defect is logic, fix, re-run the gate, and commit with a `fix(...)` message.

- [ ] **Step 6: Whole-branch review**

Run the `superpowers:requesting-code-review` skill over `git --no-pager diff main...HEAD`, apply the findings that are correct, and skip (with a written reason) those that are not.

- [ ] **Step 7: Clean up processes**

Stop the dev server you started (TaskStop or kill its PID and children), run `agent-browser close` for your named session, and confirm with `pgrep -af 'next dev|agent-browser'` that nothing you started is left.

- [ ] **Step 8: Finish**

Use `superpowers:finishing-a-development-branch`. Per the standing branch-lifecycle rule, merge `redesign/papel-ledger` into `main` and delete the branch locally and on the remote without asking; verify the merge with `git --no-pager log --oneline -5` and `git --no-pager branch -a` (RTK can hide lines). Do not inspect Vercel; tell the user it is pushed and ask them to verify.
