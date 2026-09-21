# Papel Moneda — Phase 5: Insights & Ask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skills:** every UI task runs under `/impeccable` (`.claude/skills/impeccable`); load `reference/craft-floor.md` before editing UI. **Load the `dataviz` skill before Tasks 3–5 (any chart code).** Composition is fixed by "Locked composition" below; do not re-run concept-seed.

**Goal:** Move `/insights` (all charts and lists) and `/ask` onto the Papel Moneda primitives: charts become engraved plates, Ask becomes a ruled conversation sheet.

**Architecture:** No new visual family and no query, route or schema changes. Three small new pieces: `Plate` (a captioned sheet that replaces `ChartCard`), `PlateDefs` + `PLATE_TOOLTIP_STYLE` (SVG hatch patterns and the paper-slip tooltip shared by every Recharts chart), and two pure helpers under TDD (`hatchFor`, `shareRows`). The categorical series `--chart-2 … --chart-8` are re-derived as inks that clear 3:1 on the real Papel surfaces. The spend donut becomes a ruled spend ledger (stamp, share, amount). Budget bars and debt health reuse `LedgerBlock` + `RuleMeter`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Recharts, next-intl, `@ai-sdk/react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` (Phase 5 row, "Insights" and "Ask" bullets). Parent plan Task 16: `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md`. Visual system: `DESIGN.md`.

## Global Constraints

- One note per screen at most; **Insights and Ask carry no Note** (parent plan Task 16).
- Series are told apart by **hatch pattern plus ink**, never colour alone; every chart must read in greyscale. No flat colour fills, no gradients.
- Axes and grid are hairlines in `--paper-line`; ink lines use `--foreground`/`--chart-N`. Tooltips are paper slips (`--popover`, hairline, `--radius`, no shadow).
- `--chart-1` must stay equal to `--ring` (`lib/palette.test.ts`). Chart marks clear 3:1 on light `#eeebf5` and dark `#1d1829`.
- Use `.figure` for amounts and `.legend` for caps. Copy lives in `messages/{en,es}.json` in parity.
- Masked figures stay masked: keep every `useMaskedFormatMoney` / `formatMoney` choice exactly as it is today (cashflow's expense stays unmasked, the rest mask).
- Keep the `ResponsiveContainer height={256}` numbers (a numeric height avoids the width(-1)/height(-1) warning; see the existing comments).
- Do not use guilloche, microprint or serials on rows or charts. State never rides on colour alone.
- Update the in-app help guide (page, mocks, en + es) with the change (`InsightsMock`, `AskMock`).
- Dev server: check `ss -ltnp | grep 3000` first, **ask the user before starting it**, one server, `run_in_background`, stop it and `agent-browser close` in the same turn.
- Work happens on branch `redesign/papel-insights`. **Ask the user before creating a worktree**; a plain branch off `main` needs no worktree.

---

## Locked composition

**`/insights`**: `PageHeader` → `FxDegradedNotice` → three bands, each `SectionLegend` (with the month picker as its `aside` in *This month*) over a grid of `Plate`s. Band and card order are unchanged (Position: net worth, cash flow; This month: pace, spend, budgets; Debt: health, cost).

**`Plate`**: a `Card` sheet (`gap-0 p-0`, hairline) with a caption row (`legend` caps "Fig. N · Title", the basis "when charged / when paid" as a right-aligned aside, a heavy `--rule` under it) and a padded body. The lucide icon discs go away. Figure numbers are printed per page in DOM order (1–8), passed by the page.

**Charts**
- *Net worth*: ink line in `--chart-1` with a hatched (`plate-1`) area underneath, dots kept, hairline axes, zero line only when the series crosses it.
- *Cash flow*: income = `plate-1` hatch (vertical lines) with a solid `--chart-1` top edge; expense = `plate-4` hatch (cross-hatch) with a solid `--chart-4` edge; net = `--foreground` 2px line with dots. Legend beneath, each entry drawn as a hatch swatch.
- *Pace*: this period = solid `--chart-1` 2px; last period = `--muted-foreground` 1.5px dashed (already pattern-distinct). Keep the legend.
- *Spend*: **ruled spend ledger, not a donut** (the parent plan left the choice to the comp round; the stored category colours are user ink and read best as `Stamp`s). Head total as a caption line ("This month" + `MoneyDisplay`), then `LedgerRow`s: `Stamp` lead, name, share `%` as `meta`, amount, and a hairline share strip under each row (`RuleMeter`, used = row value, total = largest row).
- *Budgets*: `LedgerBlock` per row: `Stamp`-less head (name, "used / budget", percent as `meta`) and a `RuleMeter`. Over budget adds `ProofMark tone="flag"` "Over budget" (same vocabulary as Phase 4).
- *Debt health*: same `LedgerBlock` + `RuleMeter` pattern; card utilisation ≥ 50% prints `near`, ≥ 80% adds `ProofMark tone="flag"`. Loan payoff is a plain meter.
- *Debt cost*: `LedgerRow` per account (link kept), subtotals under a `DoubleRule`.

**`/ask`**: header → one ruled conversation sheet. A question prints as a right-aligned ruled slip with a `legend` "You / Tú" tag; an answer prints as the sheet's body with hairline rules; markdown tables become ruled ledger tables (double rule under the head, amount cells `figure`, right-aligned). The empty state is a ruled slip with the prompt. The input is a baseline-rule field with the label above and the app's primary `Button` (ink slab); the read-only note is a `legend`-style footnote. Streaming narration, the error line, `warm()`, the `asked`/`sending` refs and the transport are **kept verbatim**.

**Palette (light).** `--chart-1 #4a1f8c` (= `--ring`), then `--chart-2 #7a5a00`, `--chart-3 #0a7a6a`, `--chart-4 #a2461e`, `--chart-5 #8b3fa8`, `--chart-6 #5f7a1c`, `--chart-7 #1a6f9c`, `--chart-8 #b03a68` (each ≥ 4.1:1 on `#eeebf5`). Dark values are kept as they are (`#a488ec, #D88C1F, #2FB39D, #F36549, #BA6DDC, #97AA48, #35A8E1, #ED5B85`; all ≥ 3:1 on `#1d1829`). If Task 1's test disagrees, adjust the hex and re-run rather than loosening the test.

---

## File structure

| File | Change |
| --- | --- |
| `lib/papel/plate.ts` (+ `.test.ts`) | new: `HATCHES`, `hatchFor(index)` |
| `lib/insights/share.ts` (+ `.test.ts`) | new: `shareRows(data, total, max)` |
| `components/papel/plate.tsx` (+ `.test.tsx`) | new: `Plate` |
| `components/papel/plate-defs.tsx` | new: `PlateDefs`, `PLATE_TOOLTIP_STYLE` |
| `app/globals.css`, `lib/palette.test.ts` | light `--chart-2…8`; test surface `#eeebf5` |
| `components/insights/*.tsx` | restyle all seven; `spend-donut.tsx` → `spend-ledger.tsx` |
| `components/insights/lazy-charts.tsx` | export rename |
| `components/goals/goal-balance-chart.tsx` | same plate treatment |
| `app/(app)/insights/page.tsx` | `Plate` + `SectionLegend` replace `ChartCard`/`Section` |
| `components/ask/ask-chat.tsx`, `ask-answer.tsx`, `app/(app)/ask/page.tsx` | ruled sheet |
| `components/help/mocks.tsx`, `messages/{en,es}.json` | `InsightsMock`, `AskMock`, copy |
| `DESIGN.md` | Phase 5 section; trim the "Pending" list |

---

### Task 1: Chart palette and hatch helper

**Files:**
- Create: `lib/papel/plate.ts`, `lib/papel/plate.test.ts`
- Modify: `app/globals.css` (`:root` `--chart-2 … --chart-8`, and drop the "unchanged until Phase 5" comments in both blocks), `lib/palette.test.ts`

**Interfaces:**
- Produces: `HATCHES: readonly { angle: number; gap: number }[]` (length 8), `hatchFor(index: number): { slot: number; angle: number; gap: number }` where `slot` is `1..8` and wraps.

- [ ] **Step 1: Write the failing test** (`lib/papel/plate.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { HATCHES, hatchFor } from "./plate";

describe("hatchFor", () => {
  it("has eight patterns that differ from each other", () => {
    expect(HATCHES).toHaveLength(8);
    const keys = HATCHES.map((h) => `${h.angle}/${h.gap}`);
    expect(new Set(keys).size).toBe(8);
  });
  it("maps a zero-based index onto slots 1..8 and wraps", () => {
    expect(hatchFor(0).slot).toBe(1);
    expect(hatchFor(7).slot).toBe(8);
    expect(hatchFor(8).slot).toBe(1);
  });
  it("never returns a negative or fractional slot", () => {
    expect(hatchFor(-1).slot).toBe(8);
    expect(hatchFor(2.7).slot).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run lib/papel/plate.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/papel/plate.ts`)

```ts
/** Eight hatch grammars, one per `--chart-N` slot. Angle in degrees, gap in
 *  px between rules. Distinct on angle or density so two series never differ
 *  by colour alone. */
export const HATCHES = [
  { angle: 90, gap: 5 }, // 1 vertical
  { angle: 45, gap: 5 }, // 2 rising
  { angle: 0, gap: 5 }, // 3 horizontal
  { angle: 45, gap: 3 }, // 4 fine rising (cross-hatch is drawn on top in PlateDefs)
  { angle: 135, gap: 5 }, // 5 falling
  { angle: 90, gap: 3 }, // 6 fine vertical
  { angle: 0, gap: 3 }, // 7 fine horizontal
  { angle: 135, gap: 3 }, // 8 fine falling
] as const;

export function hatchFor(index: number) {
  const i = ((Math.floor(index) % 8) + 8) % 8;
  return { slot: i + 1, ...HATCHES[i] };
}
```

- [ ] **Step 4: Run to verify it passes.** Same command. Expected: PASS.

- [ ] **Step 5: Re-derive the light series.** In `app/globals.css` `:root`, replace the light `--chart-2 … --chart-8` values with the "Palette (light)" list above and delete both `/* --chart-2 … --chart-8: unchanged until Phase 5 */` comments (light and `.dark`; keep the dark values). In `lib/palette.test.ts` change the light surface constant to Papel's real paper and the two test titles:

```ts
// Papel's light --paper, the surface charts print on (app/globals.css :root).
const CARD_LIGHT = luminance("#eeebf5");
```

and use `CARD_LIGHT` in place of `WHITE` in the `clears 3:1 against the light surface` test (keep `WHITE` for the swatch tests).

- [ ] **Step 6: Run** `npx vitest run lib/palette.test.ts lib/tokens.test.ts`. Expected: PASS. If a hex fails, nudge its lightness darker and re-run.

- [ ] **Step 7: Commit**

```bash
git add lib/papel/plate.ts lib/papel/plate.test.ts app/globals.css lib/palette.test.ts
git commit -m "feat(papel): chart inks that clear 3:1 on the paper, and a hatch grammar per slot"
```

---

### Task 2: `Plate`, `PlateDefs` and the paper-slip tooltip

**Files:**
- Create: `components/papel/plate.tsx`, `components/papel/plate.test.tsx`, `components/papel/plate-defs.tsx`

**Interfaces:**
- Consumes: `hatchFor` (Task 1), `SectionLegend`-style caps (`legend` class), `Card` from `components/ui/card`.
- Produces: `Plate({ fig: number; title: string; basis?: string; className?: string; children })`, `PlateDefs()` (renders `<defs>` with patterns `plate-1 … plate-8`, stroke `var(--chart-N)`), `PLATE_TOOLTIP_STYLE: React.CSSProperties`, `PLATE_AXIS = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const`, `PLATE_GRID = { stroke: "var(--paper-line)", vertical: false } as const`.

- [ ] **Step 1: Failing test** (`components/papel/plate.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Plate } from "./plate";

describe("Plate", () => {
  it("prints the figure number, title and basis in the caption", () => {
    const html = renderToStaticMarkup(
      <Plate fig={3} title="Spending pace" basis="when charged">
        <p>body</p>
      </Plate>,
    );
    expect(html).toContain("Fig. 3");
    expect(html).toContain("Spending pace");
    expect(html).toContain("when charged");
    expect(html).toContain("<p>body</p>");
  });
  it("omits the basis when none is given", () => {
    const html = renderToStaticMarkup(<Plate fig={1} title="Net worth"><i /></Plate>);
    expect(html).not.toContain("when");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run components/papel/plate.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** `components/papel/plate.tsx`

```tsx
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A chart's printed plate: a hairline sheet with a captioned head. `basis`
 *  says how the plate counts money ("when charged" / "when paid"). */
export function Plate({
  fig,
  title,
  basis,
  className,
  children,
}: {
  fig: number;
  title: string;
  basis?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("h-full gap-0 p-0", className)}>
      <div className="flex min-h-10 items-end justify-between gap-3 border-b-2 border-(--rule) px-4 pb-1.5 pt-3">
        <h3 className="legend min-w-0 truncate text-[11px] text-foreground">
          <span className="text-muted-foreground">Fig. {fig} · </span>
          {title}
        </h3>
        {basis ? <span className="shrink-0 text-xs text-muted-foreground">{basis}</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </Card>
  );
}
```

`components/papel/plate-defs.tsx` (client-safe, no hooks):

```tsx
import { HATCHES } from "@/lib/papel/plate";

export const PLATE_TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--paper-line)",
  borderRadius: "var(--radius)",
  boxShadow: "none",
  fontSize: 12,
} as const;

export const PLATE_AXIS = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
export const PLATE_GRID = { stroke: "var(--paper-line)", vertical: false } as const;

/** Hatch fills for a Recharts `<svg>`: `fill="url(#plate-N)"`, N = chart slot.
 *  Slot 4 also gets a crossing rule so cash-flow's two bars differ by more
 *  than angle alone. Identical ids on one page carry identical content. */
export function PlateDefs() {
  return (
    <defs>
      {HATCHES.map((h, i) => {
        const n = i + 1;
        return (
          <pattern key={n} id={`plate-${n}`} width={h.gap} height={h.gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${h.angle})`}>
            <line x1="0" y1="0" x2="0" y2={h.gap} stroke={`var(--chart-${n})`} strokeWidth={1.25} />
            {n === 4 ? <line x1="0" y1="0" x2={h.gap} y2="0" stroke={`var(--chart-${n})`} strokeWidth={1.25} /> : null}
          </pattern>
        );
      })}
    </defs>
  );
}
```

- [ ] **Step 4: Run** the test again. Expected: PASS. Then `npx tsc --noEmit -p .`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/papel/plate.tsx components/papel/plate.test.tsx components/papel/plate-defs.tsx
git commit -m "feat(papel): Plate, hatch defs and the paper-slip chart tooltip"
```

---

### Task 3: Position and pace plates (net worth, cash flow, pace, goal balance)

**Files:**
- Modify: `components/insights/net-worth-chart.tsx`, `cashflow-chart.tsx`, `spending-pace.tsx`, `components/goals/goal-balance-chart.tsx`

**Interfaces:**
- Consumes: `PlateDefs`, `PLATE_TOOLTIP_STYLE`, `PLATE_AXIS`, `PLATE_GRID` (Task 2).
- Produces: same component names and props as today.

Load the `dataviz` skill first. For each chart, the edit is mechanical; keep every comment that explains a *behaviour* (fixed height, `domain`, masking) and rewrite comments that describe colour.

- [ ] **Step 1: `net-worth-chart.tsx`.** Delete the `linearGradient` `<defs>` and replace it with `<PlateDefs />`. Set `fill="url(#plate-1)"` on the `Area`, keep `stroke="var(--chart-1)" strokeWidth={2}` and the dots. Replace the `CartesianGrid` with `<CartesianGrid {...PLATE_GRID} />` (no dash), spread `PLATE_AXIS` on both axes (keep `width`, `domain`, `tickFormatter`), `contentStyle={PLATE_TOOLTIP_STYLE}` on `Tooltip`, and the zero `ReferenceLine` stroke `var(--rule)`.
- [ ] **Step 2: `cashflow-chart.tsx`.** Add `<PlateDefs />`; income `Bar` `fill="url(#plate-1)" stroke="var(--chart-1)" strokeWidth={1.25}`; expense `Bar` `fill="url(#plate-4)" stroke="var(--chart-4)" strokeWidth={1.25}`; drop `radius` (square, engraved edges); net `Line` gets `dot={{ r: 3, fill: "var(--foreground)", strokeWidth: 0 }}`. Add `<Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />` from recharts. Grid, axes and tooltip as Step 1. Keep the `item?.dataKey === "expense"` masking branch verbatim.
- [ ] **Step 3: `spending-pace.tsx`.** Grid, axes and tooltip as Step 1; keep both lines, the legend and the long comment about the period keys unchanged.
- [ ] **Step 4: `goal-balance-chart.tsx`.** Same as net worth (hatch area, ink line, hairline grid, slip tooltip). Read the file first and keep its own data and formatter logic.
- [ ] **Step 5: Verify.** `npx tsc --noEmit -p . && npx eslint components/insights components/goals`. Expected: clean.
- [ ] **Step 6: Commit**

```bash
git add components/insights components/goals/goal-balance-chart.tsx
git commit -m "style(insights): position, cash flow, pace and goal balance print as engraved plates"
```

---

### Task 4: Spend ledger replaces the donut

**Files:**
- Create: `lib/insights/share.ts`, `lib/insights/share.test.ts`, `components/insights/spend-ledger.tsx`
- Delete: `components/insights/spend-donut.tsx`
- Modify: `components/insights/lazy-charts.tsx`, `messages/en.json`, `messages/es.json` (`Insights.spendOther`)

**Interfaces:**
- Consumes: `LedgerRow`, `Stamp`, `RuleMeter`, `MoneyDisplay`, `Insights["distribution"]`.
- Produces: `shareRows(data: { name: string; value: number; color: string }[], total: number, max?: number): { name: string; value: number; color: string; pct: number; rest: boolean }[]`; `SpendLedger({ data, total, currency })`.

- [ ] **Step 1: Failing test** (`lib/insights/share.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { shareRows } from "./share";

const d = (name: string, value: number) => ({ name, value, color: "#123456" });

describe("shareRows", () => {
  it("returns each row with its share of the total", () => {
    const rows = shareRows([d("a", 75), d("b", 25)], 100);
    expect(rows.map((r) => r.pct)).toEqual([75, 25]);
    expect(rows.every((r) => !r.rest)).toBe(true);
  });
  it("rolls everything past `max` into one rest row so the rows still sum to the total", () => {
    const rows = shareRows([d("a", 50), d("b", 30), d("c", 15), d("d", 5)], 100, 2);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ rest: true, value: 20, pct: 20 });
  });
  it("gives a zero total zero shares, never NaN", () => {
    expect(shareRows([d("a", 0)], 0)[0].pct).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/insights/share.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** (`lib/insights/share.ts`)

```ts
type Slice = { name: string; value: number; color: string };

/** Ledger rows for a spend breakdown. Rows past `max` fold into one trailing
 *  `rest` row (its `name` is left empty for the caller to localise) so the
 *  printed amounts always add up to the total. */
export function shareRows(data: Slice[], total: number, max = 7) {
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const head = data.slice(0, max).map((s) => ({ ...s, pct: pct(s.value), rest: false }));
  const tail = data.slice(max);
  if (tail.length === 0) return head;
  const value = tail.reduce((sum, s) => sum + s.value, 0);
  return [...head, { name: "", value, color: "var(--muted-foreground)", pct: pct(value), rest: true }];
}
```

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Build `spend-ledger.tsx`** (client component; keeps the empty-state text key `spendDonutEmpty`):

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { shareRows } from "@/lib/insights/share";
import type { Insights } from "@/lib/insights/queries";

export function SpendLedger({ data, total, currency }: { data: Insights["distribution"]; total: number; currency: string }) {
  const t = useTranslations("Insights");
  const maskedFormat = useMaskedFormatMoney();
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendDonutEmpty")}</p>;
  }
  const rows = shareRows(data, total);
  const largest = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="-mx-4 -mb-4">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3">
        <span className="legend text-[11px] text-muted-foreground">{t("thisMonth")}</span>
        <MoneyDisplay amount={total} currency={currency} size="stat" />
      </div>
      <ul className="border-t border-(--paper-line)">
        {rows.map((r) => {
          const name = r.rest ? t("spendOther") : r.name;
          return (
            <li key={r.rest ? "rest" : r.name} className="border-b border-(--paper-line) last:border-b-0">
              <LedgerRow
                className="border-b-0 pb-1.5"
                lead={<Stamp color={r.color} name={name} />}
                title={name}
                amount={maskedFormat(r.value, currency)}
                meta={`${r.pct.toFixed(r.pct < 10 ? 1 : 0)}%`}
              />
              <div className="px-4 pb-3">
                <RuleMeter used={r.value} total={largest} label={`${name} ${r.pct.toFixed(0)}%`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6:** In `lazy-charts.tsx` swap the `SpendDonut` dynamic import for `SpendLedger` (same `ssr:false`/skeleton options, read the file); delete `spend-donut.tsx`. Add `"spendOther": "Everything else"` (en) and `"Todo lo demás"` (es) to `Insights`.
- [ ] **Step 7: Verify.** `npx tsc --noEmit -p . && npx vitest run lib/insights`. Expected: clean, PASS. `grep -rn "SpendDonut\|spend-donut" app components` returns nothing except help copy names.
- [ ] **Step 8: Commit**

```bash
git add -A lib/insights components/insights messages
git commit -m "feat(insights): the spend breakdown prints as a stamped ledger, not a donut"
```

---

### Task 5: Budgets, debt health and debt cost as ledgers

**Files:**
- Modify: `components/insights/budget-bars.tsx`, `debt-health.tsx`, `debt-cost.tsx`, `messages/{en,es}.json` (`Insights.overBudget`, `Insights.utilizationHigh`, only if `Budgets` keys can't be reused; prefer reusing `Budgets`'s existing "Over budget" key via `useTranslations("Budgets")`)

**Interfaces:**
- Consumes: `LedgerBlock`, `LedgerRow`, `RuleMeter`, `ProofMark`, `DoubleRule`, `meterArgs` (`lib/budgets/bar.ts`, `meterArgs(used, budget) → { used, total }`).

- [ ] **Step 1: `budget-bars.tsx`.** Replace the `space-y-4` list with `<div className="-mx-4 -mb-4">` of `LedgerBlock`s. Head: `<LedgerRow title={row.name} subtitle={usedOfBudget} amount={formatMoney(row.used, currency)} meta={pctText} />`. Body: `<RuleMeter {...meterArgs(row.used, row.budget)} label={row.name} overLabel={overLabel} near={pct >= 85 && !over} />`, and when `over`, `<ProofMark tone="flag">{overLabel}</ProofMark>`. Where the existing code computes `over`/`pct`, keep it.
- [ ] **Step 2: `debt-health.tsx`.** Drop `tone()` and the private `Bar`. Two `SectionLegend`-free groups: each label is a `legend text-[11px] text-muted-foreground` line, then `LedgerBlock`s per account (head `LedgerRow title={name · currency} meta={formatPercent(pct)}`; body `RuleMeter used={pct} total={100}` with `near={pct >= 50}` for utilisation only, plus `ProofMark tone="flag"` when `pct >= 80`).
- [ ] **Step 3: `debt-cost.tsx`.** `Rows` become `LedgerRow`s wrapped in `Link` (keep `href`, hover via `hover:bg-muted/50`); the two `h4`s become `legend` lines; each `Subtotal` block sits under `<DoubleRule />` instead of `border-t`.
- [ ] **Step 4: Verify** `npx tsc --noEmit -p . && npx eslint components/insights`. Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add components/insights messages
git commit -m "style(insights): budgets, debt health and debt cost print as ruled ledgers"
```

---

### Task 6: The Insights page

**Files:**
- Modify: `app/(app)/insights/page.tsx`

- [ ] **Step 1:** Delete the local `ChartCard` and `Section`, and the unused lucide icon imports. Import `Plate` and `SectionLegend`. Replace each `ChartCard title=… icon=…` with `<Plate fig={N} title=… basis=… className=…>` numbered 1–8 in the current DOM order. Replace `Section` with `<section className="space-y-4"><SectionLegend aside={actions}>{title}</SectionLegend><div className="grid gap-6 @[34rem]:grid-cols-2">…</div></section>`.
- [ ] **Step 2:** Render the month nav's label with `figure`; give its arrow links `rounded-(--radius)` and keep `scroll={false}`. Keep every explanatory comment about container queries and bands.
- [ ] **Step 3: Verify.** `npx tsc --noEmit -p . && npx eslint app components`. Expected: clean. Then, **after asking the user** (dev-server rule), open `/insights` at 1280px and 360px, light and dark, `es`, with `agent-browser --session "$(agent-browser session id --scope worktree --prefix tywin)"`; confirm nothing overflows at 360px, every plate reads in greyscale (`agent-browser eval` to set `filter: grayscale(1)` on `body`), tooltips are slips. Stop the server and `agent-browser close` in the same turn.
- [ ] **Step 4: Commit**

```bash
git add "app/(app)/insights/page.tsx"
git commit -m "style(insights): the page is three legends over captioned plates"
```

---

### Task 7: Ask as a ruled conversation sheet

**Files:**
- Modify: `components/ask/ask-chat.tsx`, `components/ask/ask-answer.tsx`, `components/ask/ask-answer.test.tsx` (only if an assertion pins a class), `messages/{en,es}.json` (`Ask.you`)

**Interfaces:** props unchanged. `Ask.you` = "You" / "Tú".

- [ ] **Step 1: `ask-answer.tsx`.** Keep `closeOpenMarkdown` and the element map. Change: `thead` → `border-b-2 border-(--rule)`; `tbody` divider `divide-(--paper-line)`; `th` `legend text-[11px]`; `code`/`pre` background `bg-muted` stays; `blockquote` `border-l-2 border-(--rule)`; `hr` `border-(--paper-line)`; `strong` unchanged. Numeric cells stay `figure`.
- [ ] **Step 2: `ask-chat.tsx`.** Replace the `Card` bubbles with ruled slips: user turn = `<div className="max-w-[85%] self-end border border-(--paper-line) bg-muted/50 px-3 py-2"><p className="legend text-[10px] text-muted-foreground">{t("you")}</p><p className="whitespace-pre-wrap text-sm">{body}</p></div>`; answer = `<div className="w-full border-y border-(--paper-line) py-3">…<AskAnswer/></div>` (no card). The empty state becomes the same ruled slip with `emptyTitle`/`emptyHint`. Input: `<input>` gets `className="min-w-0 flex-1 border-0 border-b border-(--rule) bg-transparent px-0 py-2 text-sm focus-visible:border-b-2 focus-visible:outline-none"`, and the submit is the app `Button` (read `components/ui/button.tsx`) with `type="submit"`, `disabled={busy || !input.trim()}`. The `readOnly` note gets `legend` styling. **Do not touch** the transport, `warm`, the three refs, `narration`, `silent`/`wordless` logic or the error line.
- [ ] **Step 3: Verify.** `npx vitest run components/ask lib/ask && npx tsc --noEmit -p . && npx eslint components/ask`. Expected: PASS, clean. Behaviour check (after asking about the dev server): send one question, confirm narration, then the answer as a slip, and a table answer renders with a double-ruled head; 360px has no horizontal page scroll.
- [ ] **Step 4: Commit**

```bash
git add components/ask messages
git commit -m "style(ask): the conversation is a ruled sheet with a baseline-rule input"
```

---

### Task 8: Help mocks and copy

**Files:**
- Modify: `components/help/mocks.tsx` (`InsightsMock`, `AskMock`), the `Help` section of `messages/{en,es}.json` only if a chapter's prose describes the donut or "coloured bars"; `app/(app)/help/page.tsx` if the mock's props change.

- [ ] **Step 1:** Rebuild `InsightsMock` inside `SpecimenFrame` from `Stamp` + `LedgerRow` + `RuleMeter`: the total caption, then four rows (`essentials 38%`, `discretionary 23%`, `subscriptions 15%`, `other 24%`) exactly like `SpendLedger`; delete the `conic-gradient`. Rebuild `AskMock` with the ruled user slip (`legend` "You") and the ruled answer, no `rounded-2xl`, no `bg-primary`. Keep the existing prop names so `help/page.tsx` call sites and copy stay valid.
- [ ] **Step 2:** Read the Insights and Ask help chapters in both locales; rewrite any sentence that says "ring", "donut", "coloured bar" or "bubble" to describe the ledger and slips (en + es).
- [ ] **Step 3: Verify.** `npx tsc --noEmit -p . && npx vitest run` (full suite, including the i18n key-parity test). Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add components/help messages "app/(app)/help/page.tsx"
git commit -m "docs(help): Insights and Ask mocks match the plates and the ruled sheet"
```

---

### Task 9: Close-out

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1:** Add a "Insights and Ask (Phase 5)" section to `DESIGN.md` (after Phase 4): `Plate`, `PlateDefs` and the chart grammar (hatch per slot, hairline axes, slip tooltip, the eight inks and their 3:1 rule), the spend ledger, and the Ask sheet. In "Pending", remove Phase 5 from the phase list, the `--chart-2 … --chart-8` "incumbent" bullet (they are Papel now; Phase 7 keeps only the `--hero` slab and the aliases), and `InsightsMock`/`AskMock` to the "done" list. Update the "Do" list only if a new rule was learned.
- [ ] **Step 2:** Run `node .claude/skills/impeccable/scripts/detect.mjs components/insights components/ask components/papel app/\(app\)/insights app/\(app\)/ask`; fix findings or record an `ignoreValues` reason in `.impeccable/config.json`.
- [ ] **Step 3:** One batched screenshot round (desktop + 360px, light + dark, es) on `/insights`, `/ask`, `/help#insights`, `/help#ask`; one fix batch; at most one confirm round. Dispatch the `impeccable-finish-reviewer`, then run `/impeccable audit` and `polish` on the two routes.
- [ ] **Step 4: Final verification.** `npx tsc --noEmit -p . && npx eslint . && npx vitest run`. Expected: all clean/PASS. Report actual output.
- [ ] **Step 5: Commit, merge, delete.** Commit the DESIGN.md change; per the branch-lifecycle memory merge `redesign/papel-insights` into `main` and delete it locally and on the remote, then verify with `git --no-pager branch -a` (RTK can hide output; use `git --no-pager` or `rtk proxy`).

```bash
git add DESIGN.md .impeccable/config.json
git commit -m "docs(design): record Phase 5 (Insights and Ask) in DESIGN.md"
```

---

## Self-review

- **Spec coverage:** engraved plates with hatch + ink and hairline axes (Tasks 1–3); spend donut → ruled list (Task 4, flagged as the one open composition choice); pace, debt health/cost (Tasks 3, 5); Ask ruled sheet (Task 7); paper-slip tooltips (Task 2); palette re-derived, 3:1, `chart-1 = --ring` (Task 1); help mocks (Task 8); DESIGN.md (Task 9). "Answers print as ledger excerpts when they carry figures" is met by ledger-styled tables; a per-answer `LedgerRow` conversion would need the model to emit structured output and is deliberately out of scope.
- **Placeholders:** none; Tasks 3, 5 and 7 give exact class and prop edits against files whose current contents were read.
- **Types:** `hatchFor`/`HATCHES`, `PlateDefs`/`PLATE_*`, `shareRows` and `SpendLedger` are named the same wherever they are used.
