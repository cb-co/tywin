# Papel Moneda — Phase 4: Budgets, Goals & Recurring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skill:** every UI task runs under `/impeccable` (`.claude/skills/impeccable`). Load `reference/craft-floor.md` before editing UI. Composition is fixed by "Locked composition" below (the shape brief was confirmed); do not re-run concept-seed.

**Goal:** Move `/budgets` (budget total, groups, categories, goals), the goal detail page and `/recurring` onto the Papel Moneda primitives, per Phase 4 of the redesign spec.

**Architecture:** No new visual family. The Phase 0-3 primitives (`Note`, `LedgerRow`, `Stamp`, `RuleMeter`, `ProofMark`, `Perforation`'s cell grammar, `Mark`, `Card` as the sheet) are recomposed. Four small pieces are added: `LedgerBlock` (a `LedgerRow` head with a body under it), `DoubleRule`, `SectionLegend`, and `RuleMeter`'s `near` state. Three pieces of pure logic are added under TDD: `meterArgs` (`lib/budgets/bar.ts`), `goalStripCells` (`lib/goals/strip.ts`), and `orderByNext` (`lib/subscriptions/order.ts`). `BudgetGrid` and `GroupGrid` share one `BudgetLine`. `GoalBar` becomes `GoalStrip` (its arrival burst and sound logic are kept verbatim). `PaceSummary` swaps its `StatPill` for `ProofMark`. No query, server action, route or schema changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn on `@base-ui/react`, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` (Phase 4 row and the "Budgets and goals" / "Recurring" bullets). The parent plan is `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md`. `DESIGN.md` is the visual system.

## Locked composition

**`/budgets`** (one peso Note): header → period toolbar (picker + "Copy last month", plain row, no card) → **peso `Note`**: label `Budgets.budgetLabel`, figure = the period budget total (`MoneyDisplay size="hero"` fitted by `fitFigureClass`), serial `periodSerial(period.start)`, with two ruled sub-lines *Used* and *Remaining* → group band (only when a group exists) → category band → double rule → Goals. The Note is skipped when there are no category rows, so at most one ever renders.

**Band pattern:** `SectionLegend` (engraved caps over a heavy `--rule`, optional aside) then one `Card` sheet (`gap-0 p-0`, hairline) of `LedgerBlock`s.

**Budget line** (`BudgetLine`, used by categories and groups): head `LedgerRow` = category `Stamp` lead, name, "used of budget" subtitle, tabular used amount, percent as `meta`. Body = optional prorated line, a `RuleMeter` with a `BudgetStatusMark` beside it, then the inline amount `Input` + edit + delete.

**Status vocabulary** (the open decision from the brief, resolved here; state is never colour alone):
- `within`: nothing extra. The calm state is the quietest one.
- `approaching`: `Mark` "Near" / "Cerca" and a heavy (2px) rule under the meter (`RuleMeter near`).
- `over`: `ProofMark tone="flag"` "Over budget" / "Excedido", red fill, double-rule end cap (the meter's existing over state).

**Goals** (no Note): totals line → `SectionLegend` + sheet of `LedgerBlock`s. Head = `Stamp`, name as a link to the detail page, "saved of target" subtitle, percent. Body = `GoalStrip` (20 cells: solid = backed by real money, hatched = borrowed back, dashed outline = remaining), `PaceSummary` (verdict is a `ProofMark`: success → ok, warning and destructive → flag; the label text carries the meaning), then Contribute / edit / delete. The goal's own colour appears only in its `Stamp`. Goal detail reuses `GoalStrip` and prints contributions as ledger rows.

**Recurring** (no Note): plain ruled totals line (monthly recurring, and monthly income when income templates exist) → income band and other band separated by a `DoubleRule` (bands only when both exist, exactly today's rule) → each band a sheet of `LedgerBlock`s **ordered by next charge date**, paused rows last. Head = `BrandMark` lead, name, "kind · cycle" subtitle, amount, "Next <date>" as `meta`. Body = the monthly-equivalent line when it differs, the account line, then the control row (switch, edit, delete on the left, Record on the right).

## Global Constraints

- Tokens are already global. This phase never edits a colour value; it only changes which component reads which token. Tokens used: `--ink`, `--ink-soft`, `--paper-line`, `--rule`, `--teal`, `--red`, `--peso`.
- **At most one Note per screen.** `/budgets` has one (peso). The goal detail page and `/recurring` have none.
- Ornament (guilloche, microprint, serials) only on the Note; never on rows or forms.
- State is a glyph, rule weight or ink density, never colour alone. Overspend and behind-pace never rely on red.
- Category, account and goal colour is user data: only through `Stamp`. Never set text in a user hex. Brand colour on `BrandMark` is third-party data and stays a filled disc with a measured foreground (`readableForeground`).
- WCAG 2.2 AA: 4.5:1 body text, keyboard-complete, visible 2px `currentColor` focus outline, `prefers-reduced-motion` honoured with an end state. Text on the peso Note uses `--peso-ink`.
- i18n: no hardcoded copy; `messages/en.json` and `messages/es.json` change together in every task that adds a key; existing keys are never renamed or removed. Bank terms stay Spanish in both.
- Must remain untouched: routes, queries, server actions, `router.refresh()` flows, the sound system, figure masking (`useMaskedFormatMoney`, `MaskedMoney`, `MoneyDisplay`), the period picker's behaviour, goal funding clamps and `Pace` arithmetic, the goal-completion burst (fires once per arrival, never on load), 360px Spanish truncation, FAB clearance, safe-area insets.
- Density: a budget line is ≤ 120px tall and a goal or recurring block ≤ 140px at 360px.
- Help guide upkeep: the `/help` Budgets, Budget groups and Recurring chapters, their mocks (`BudgetsMock`, `BudgetGroupsMock`, `SubscriptionsMock`) and `Help.*` keys change in this phase (Task 8).
- Machine rules: ask before starting a dev server. One server, fixed port, `run_in_background`, `NODE_OPTIONS=--max-old-space-size=6144`, stopped in the same turn (`pgrep` to confirm), and `agent-browser close` for the named session (`agent-browser session id --scope worktree --prefix tywin`).
- **Work directly on `main`. No branch, no worktree** (the user's instruction for this phase). Verify git state with `git --no-pager` (RTK mangles git output; use `rtk proxy` if a result looks wrong).
- Each commit message ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Verification commands: `npx tsc --noEmit`, `npx eslint <changed files>`, `npx vitest run <paths>`.

## File Structure

**Create:**
- `components/papel/ledger-block.tsx` (+ `.test.tsx`), `components/papel/double-rule.tsx` (+ `.test.tsx`), `components/papel/section-legend.tsx` (+ `.test.tsx`), `components/papel/rule-meter.test.tsx`
- `lib/goals/strip.ts` (+ `strip.test.ts`), `lib/subscriptions/order.ts` (+ `order.test.ts`)
- `components/budgets/budget-status-mark.tsx` (+ `.test.tsx`), `components/budgets/budget-line.tsx`, `components/budgets/budget-note.tsx`
- `components/goals/goal-strip.tsx` (+ `.test.tsx`)

**Modify:**
- `components/papel/rule-meter.tsx` (`near`), `lib/budgets/bar.ts` (+ `bar.test.ts`, `meterArgs`)
- `components/budgets/budget-grid.tsx`, `components/budgets/group-grid.tsx`, `app/(app)/budgets/page.tsx`, `app/(app)/budgets/loading.tsx`
- `components/goals/goal-grid.tsx`, `components/goals/goal-progress.tsx`, `components/goals/contributions-list.tsx`, `app/(app)/budgets/goals/[id]/page.tsx`
- `components/subscriptions/subscriptions-view.tsx`, `app/(app)/recurring/loading.tsx`
- `components/budgets/{category-dialog,group-dialog}.tsx`, `components/goals/{goal-dialog,contribute-dialog}.tsx`, `components/subscriptions/{subscription-form-dialog,record-charge-dialog}.tsx` (audit only, Task 7)
- `components/help/mocks.tsx`, `app/(app)/help/page.tsx`, `messages/en.json`, `messages/es.json`
- `DESIGN.md`, `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md` (tick Phase 4)

---

### Task 1: Shared primitives (LedgerBlock, DoubleRule, SectionLegend, RuleMeter `near`)

**Files:**
- Create: `components/papel/ledger-block.tsx`, `components/papel/double-rule.tsx`, `components/papel/section-legend.tsx`, and a `.test.tsx` beside each, plus `components/papel/rule-meter.test.tsx`
- Modify: `components/papel/rule-meter.tsx`

**Interfaces:**
- Produces: `LedgerBlock({ head: ReactNode; children?: ReactNode; className?: string })`, `DoubleRule({ className?: string })`, `SectionLegend({ children: ReactNode; aside?: ReactNode; className?: string })`, and `RuleMeter`'s new optional `near?: boolean`.

- [ ] **Step 1: Write the failing tests**

`components/papel/ledger-block.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LedgerBlock } from "./ledger-block";

describe("LedgerBlock", () => {
  it("prints the head before the body", () => {
    const html = renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>}><p>BODY</p></LedgerBlock>);
    expect(html.indexOf("HEAD")).toBeLessThan(html.indexOf("BODY"));
  });
  it("draws no body wrapper when there are no children", () => {
    expect(renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>} />)).not.toContain("px-4 pb-3");
  });
  it("strips the head row's own rule so the block owns the separator", () => {
    expect(renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>} />)).toContain("[&>:first-child]:border-b-0");
  });
});
```
`components/papel/double-rule.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DoubleRule } from "./double-rule";

describe("DoubleRule", () => {
  it("is a decorative hr drawn as two ink rules", () => {
    const html = renderToStaticMarkup(<DoubleRule />);
    expect(html).toContain("<hr");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("border-y");
  });
});
```
`components/papel/section-legend.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionLegend } from "./section-legend";

describe("SectionLegend", () => {
  it("prints the label as a level-2 heading over a heavy rule", () => {
    const html = renderToStaticMarkup(<SectionLegend>Presupuestos</SectionLegend>);
    expect(html).toContain("<h2");
    expect(html).toContain("Presupuestos");
    expect(html).toContain("border-b-2");
  });
  it("prints the aside after the heading", () => {
    const html = renderToStaticMarkup(<SectionLegend aside={<span>ASIDE</span>}>Label</SectionLegend>);
    expect(html.indexOf("Label")).toBeLessThan(html.indexOf("ASIDE"));
  });
});
```
`components/papel/rule-meter.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleMeter } from "./rule-meter";

describe("RuleMeter near state", () => {
  it("prints a hairline base rule by default", () => {
    const html = renderToStaticMarkup(<RuleMeter used={50} total={100} label="x" />);
    expect(html).not.toContain("border-b-2");
  });
  it("prints a heavy base rule when near", () => {
    expect(renderToStaticMarkup(<RuleMeter used={85} total={100} label="x" near />)).toContain("border-b-2");
  });
  it("over wins over near: no heavy rule, red fill", () => {
    const html = renderToStaticMarkup(<RuleMeter used={120} total={100} label="x" near overLabel="Over" />);
    expect(html).not.toContain("border-b-2");
    expect(html).toContain("bg-(--red)");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/papel/ledger-block.test.tsx components/papel/double-rule.test.tsx components/papel/section-legend.test.tsx components/papel/rule-meter.test.tsx`
Expected: FAIL (modules not found; the `near` prop is unknown).

- [ ] **Step 3: Implement**

`components/papel/ledger-block.tsx`:
```tsx
import { cn } from "@/lib/utils";

/**
 * A ledger line with a body under it: `head` is a `LedgerRow`, `children` are
 * the controls or meter that belong to it. The block owns the separator, so
 * the head's own rule is stripped and there is exactly one hairline between
 * blocks. With no children it is just the head.
 */
export function LedgerBlock({
  head,
  children,
  className,
}: {
  head: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 border-b border-(--paper-line) last:border-b-0 [&>:first-child]:border-b-0", className)}>
      {head}
      {children ? <div className="min-w-0 space-y-2.5 px-4 pb-3">{children}</div> : null}
    </div>
  );
}
```
`components/papel/double-rule.tsx`:
```tsx
import { cn } from "@/lib/utils";

/** Two thin ink rules with paper between them: the printed double rule that
 *  separates two ledgers. Decorative; the headings on either side carry the
 *  meaning. */
export function DoubleRule({ className }: { className?: string }) {
  return <hr aria-hidden className={cn("h-[5px] border-0 border-y border-(--rule) bg-transparent", className)} />;
}
```
`components/papel/section-legend.tsx`:
```tsx
import { cn } from "@/lib/utils";

/** A section's heading: engraved caps over a heavy rule, with an optional
 *  aside (a period label, an action) at the far end. */
export function SectionLegend({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-end justify-between gap-4 border-b-2 border-(--rule) pb-1.5", className)}>
      <h2 className="legend text-[11px] text-foreground">{children}</h2>
      {aside ? <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
```
In `components/papel/rule-meter.tsx`: add `near` to the props type and destructuring (`near?: boolean` with a one-line doc: "Within sight of the limit: prints a heavy base rule. Ignored when over."), and change the className:
```tsx
className={cn("relative h-2 border-(--rule)", near && !over ? "border-b-2" : "border-b", className)}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run components/papel`
Expected: PASS (existing papel tests still green).

- [ ] **Step 5: Commit**

```bash
git add components/papel
git commit -m "feat(papel): LedgerBlock, DoubleRule, SectionLegend and a near state on RuleMeter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure logic (meterArgs, goalStripCells, orderByNext)

**Files:**
- Modify: `lib/budgets/bar.ts` (add `meterArgs`; keep `barPct`; leave `STATUS_COLOR` until Task 8)
- Create: `lib/budgets/bar.test.ts`, `lib/goals/strip.ts`, `lib/goals/strip.test.ts`, `lib/subscriptions/order.ts`, `lib/subscriptions/order.test.ts`

**Interfaces:**
- Produces:
  - `meterArgs(used: number, budget: number): { used: number; total: number }`. A budget above 0 passes through. No budget maps to a full meter once anything is spent and an empty one otherwise (spending against no budget is not 0% of anything). `used === total` fills to 100% without reading as over.
  - `goalStripCells(pct: number, backedShare: number, n?: number): Array<"solid" | "borrowed" | "empty">` with `n` defaulting to 20.
  - `orderByNext<T extends OrderableSub>(subs: T[], from?: Date): T[]` where `OrderableSub = { is_active: boolean; billing_cycle: string; anchor_day: number | null; anchor_date: string | null }`.

- [ ] **Step 1: Write the failing tests**

`lib/budgets/bar.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { barPct, meterArgs } from "./bar";
import { meterFill } from "@/lib/papel/meter";

describe("meterArgs", () => {
  it("passes a real budget through", () => {
    expect(meterArgs(40, 100)).toEqual({ used: 40, total: 100 });
  });
  it("fills fully, without reading as over, when spend has no budget", () => {
    const { used, total } = meterArgs(25, 0);
    expect(meterFill(used, total)).toEqual({ pct: 100, over: false });
  });
  it("stays empty when there is neither spend nor budget", () => {
    const { used, total } = meterArgs(0, 0);
    expect(meterFill(used, total)).toEqual({ pct: 0, over: false });
  });
  it("agrees with barPct on the unbudgeted cases", () => {
    expect(barPct(25, 0)).toBe(100);
    expect(barPct(0, 0)).toBe(0);
  });
});
```
`lib/goals/strip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { goalStripCells } from "./strip";

const count = (cells: string[], k: string) => cells.filter((c) => c === k).length;

describe("goalStripCells", () => {
  it("draws an empty strip at 0%", () => {
    const c = goalStripCells(0, 1);
    expect(c).toHaveLength(20);
    expect(count(c, "empty")).toBe(20);
  });
  it("fills the strip only when the goal is complete", () => {
    expect(count(goalStripCells(100, 1), "solid")).toBe(20);
    expect(count(goalStripCells(99.6, 1), "empty")).toBeGreaterThan(0);
  });
  it("shows at least one cell for any progress", () => {
    expect(count(goalStripCells(1, 1), "solid")).toBe(1);
  });
  it("orders solid, then borrowed, then empty", () => {
    const c = goalStripCells(50, 0.5);
    expect(c.slice(0, 5).every((x) => x === "solid")).toBe(true);
    expect(c.slice(5, 10).every((x) => x === "borrowed")).toBe(true);
    expect(c.slice(10).every((x) => x === "empty")).toBe(true);
  });
  it("never hides a borrowed-back share, however small", () => {
    expect(count(goalStripCells(50, 0.99), "borrowed")).toBe(1);
  });
  it("clamps out-of-range input", () => {
    expect(count(goalStripCells(-10, 1), "empty")).toBe(20);
    expect(count(goalStripCells(250, 1), "solid")).toBe(20);
    expect(goalStripCells(50, 5)).toHaveLength(20);
  });
});
```
`lib/subscriptions/order.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { orderByNext } from "./order";

const sub = (name: string, over: Partial<{ is_active: boolean; billing_cycle: string; anchor_day: number | null; anchor_date: string | null }> = {}) => ({
  name,
  is_active: true,
  billing_cycle: "monthly",
  anchor_day: 20,
  anchor_date: null,
  ...over,
});

const from = new Date(2026, 8, 10); // 10 Sep 2026, local

describe("orderByNext", () => {
  it("sorts by the next charge date, soonest first", () => {
    const out = orderByNext([sub("late", { anchor_day: 28 }), sub("soon", { anchor_day: 12 })], from);
    expect(out.map((s) => s.name)).toEqual(["soon", "late"]);
  });
  it("puts paused templates after every active one", () => {
    const out = orderByNext([sub("paused", { is_active: false, anchor_day: 11 }), sub("active", { anchor_day: 28 })], from);
    expect(out.map((s) => s.name)).toEqual(["active", "paused"]);
  });
  it("keeps the input order for ties and does not mutate the input", () => {
    const input = [sub("a", { anchor_day: 15 }), sub("b", { anchor_day: 15 })];
    const out = orderByNext(input, from);
    expect(out.map((s) => s.name)).toEqual(["a", "b"]);
    expect(out).not.toBe(input);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/budgets/bar.test.ts lib/goals/strip.test.ts lib/subscriptions/order.test.ts`
Expected: FAIL (modules and export missing).

- [ ] **Step 3: Implement**

Append to `lib/budgets/bar.ts`:
```ts
/**
 * The (used, total) pair to hand `RuleMeter` for a row. A real budget passes
 * through. With no budget the meter fills completely once anything is spent
 * and stays empty otherwise, the same rule `barPct` states: spending against
 * no budget is not 0% of anything. `used === total` fills the meter without
 * `meterFill` calling it over.
 */
export function meterArgs(used: number, budget: number): { used: number; total: number } {
  if (budget > 0) return { used, total: budget };
  return { used: used > 0 ? 1 : 0, total: 1 };
}
```
`lib/goals/strip.ts`:
```ts
/**
 * A goal's progress as cells. `pct` is the share of the target that is saved
 * (0-100) and `backedShare` the share of that saving actually backed by
 * money (0-1); the rest is borrowed back. Solid cells come first, then
 * borrowed, then empty, so a goal spent into reads as hollowed out rather
 * than merely smaller. Any progress shows at least one cell and only a
 * complete goal fills the strip; a borrowed share, however small, keeps one
 * visible cell.
 */
export type GoalCell = "solid" | "borrowed" | "empty";

export function goalStripCells(pct: number, backedShare: number, n = 20): GoalCell[] {
  const p = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  const share = Number.isFinite(backedShare) ? Math.min(Math.max(backedShare, 0), 1) : 1;
  const filled = p >= 100 ? n : p <= 0 ? 0 : Math.min(n - 1, Math.max(1, Math.round((p / 100) * n)));
  const borrowed = filled === 0 || share >= 1 ? 0 : Math.min(filled, Math.max(1, Math.round(filled * (1 - share))));
  return Array.from({ length: n }, (_, i): GoalCell => (i < filled - borrowed ? "solid" : i < filled ? "borrowed" : "empty"));
}
```
`lib/subscriptions/order.ts`:
```ts
import { nextChargeDate, type BillingCycle } from "./cycle";

export type OrderableSub = {
  is_active: boolean;
  billing_cycle: string;
  anchor_day: number | null;
  anchor_date: string | null;
};

/**
 * Recurring templates in ledger order: soonest next charge first, templates
 * with no computable next date and paused ones last. Stable, and never
 * mutates its input.
 */
export function orderByNext<T extends OrderableSub>(subs: T[], from = new Date()): T[] {
  const keyed = subs.map((s, i) => {
    const d = s.is_active
      ? nextChargeDate({ cycle: s.billing_cycle as BillingCycle, anchorDay: s.anchor_day, anchorDate: s.anchor_date }, from)
      : null;
    return { s, i, t: d ? d.getTime() : Number.POSITIVE_INFINITY };
  });
  return keyed.sort((a, b) => a.t - b.t || a.i - b.i).map((k) => k.s);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run lib/budgets lib/goals lib/subscriptions`
Expected: PASS. If a `nextChargeDate` case in `order.test.ts` disagrees (a monthly anchor day `<` today rolls to next month, so 12 and 28 from 10 Sep are both in September), fix the fixture, never the assertion's intent.

- [ ] **Step 5: Commit**

```bash
git add lib/budgets lib/goals lib/subscriptions
git commit -m "feat(papel): pure helpers for the budget meter, goal strip and recurring order

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: BudgetStatusMark, BudgetLine and their copy

**Files:**
- Create: `components/budgets/budget-status-mark.tsx` (+ `.test.tsx`), `components/budgets/budget-line.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Budgets` namespace)

**Interfaces:**
- Consumes: `LedgerBlock`, `RuleMeter` (`near`), `meterArgs`, `barPct`, `Stamp`, `LedgerRow`, `ProofMark`, `Mark` (`components/transactions/mark.tsx`).
- Produces:
  - `BudgetStatusMark({ status: BudgetStatus; overLabel: string; nearLabel: string })`.
  - `BudgetLine(props: BudgetLineProps)` where
    ```ts
    type BudgetLineProps = {
      name: string; color: string | null; emoji: string | null;
      used: number; budget: number; status: BudgetStatus; currency: string;
      subtitle: string;            // "340 of 500", already localised and mask-aware by the caller
      prorated: string | null;     // the "monthly · this period" line, or null
      inputKey: string; defaultAmount: number; placeholder: string; budgetAria: string;
      onSave: (raw: string) => void;
      editControl: React.ReactNode;   // the caller's <XDialog trigger=.../>
      deleteAria: string; onDelete: () => void; deleting: boolean;
    };
    ```
- New keys, `Budgets` namespace: `statusOver`, `statusApproaching`, `meterLabel` (`{name}`). Add both languages: en "Over budget" / "Near" / "{name}: budget used"; es "Excedido" / "Cerca" / "{name}: presupuesto usado". First `grep -n '"statusOver"\|"statusApproaching"\|"meterLabel"' messages/*.json` to confirm they do not exist.

- [ ] **Step 1: Write the failing test**

`components/budgets/budget-status-mark.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetStatusMark } from "./budget-status-mark";

const labels = { overLabel: "Excedido", nearLabel: "Cerca" };

describe("BudgetStatusMark", () => {
  it("prints nothing for a budget that is within", () => {
    expect(renderToStaticMarkup(<BudgetStatusMark status="within" {...labels} />)).toBe("");
  });
  it("prints an engraved tag for a budget that is near, with no proof glyph", () => {
    const html = renderToStaticMarkup(<BudgetStatusMark status="approaching" {...labels} />);
    expect(html).toContain("Cerca");
    expect(html).not.toContain("<svg");
  });
  it("prints a flag proof mark for a budget that is over", () => {
    const html = renderToStaticMarkup(<BudgetStatusMark status="over" {...labels} />);
    expect(html).toContain("Excedido");
    expect(html).toContain("<svg");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/budgets/budget-status-mark.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`components/budgets/budget-status-mark.tsx`:
```tsx
import { ProofMark } from "@/components/papel/proof-mark";
import { Mark } from "@/components/transactions/mark";
import type { BudgetStatus } from "@/lib/budgets/queries";

/** Budget state as a glyph or a tag, never a colour: nothing when within,
 *  an engraved tag when near, a flag proof mark when over. */
export function BudgetStatusMark({
  status,
  overLabel,
  nearLabel,
}: {
  status: BudgetStatus;
  overLabel: string;
  nearLabel: string;
}) {
  if (status === "over") return <ProofMark tone="flag" className="shrink-0">{overLabel}</ProofMark>;
  if (status === "approaching") return <Mark>{nearLabel}</Mark>;
  return null;
}
```
`components/budgets/budget-line.tsx`:
```tsx
"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetStatusMark } from "./budget-status-mark";
import { barPct, meterArgs } from "@/lib/budgets/bar";
import { formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/budgets/queries";
import { cn } from "@/lib/utils";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export type BudgetLineProps = {
  name: string;
  color: string | null;
  emoji: string | null;
  used: number;
  budget: number;
  status: BudgetStatus;
  currency: string;
  subtitle: string;
  prorated: string | null;
  inputKey: string;
  defaultAmount: number;
  placeholder: string;
  budgetAria: string;
  onSave: (raw: string) => void;
  editControl: React.ReactNode;
  deleteAria: string;
  onDelete: () => void;
  deleting: boolean;
};

/**
 * One budget, printed once for both bands: the category band and the group
 * band are the same money sliced two ways and must look it. Head is a ledger
 * row (stamp, name, "used of budget", tabular used amount and its share); the
 * body is the ruled meter with its status mark, then the inline amount input
 * and the edit/delete controls the old card carried.
 */
export function BudgetLine(p: BudgetLineProps) {
  const t = useTranslations("Budgets");
  const { used, total } = meterArgs(p.used, p.budget);
  return (
    <LedgerBlock
      head={
        <LedgerRow
          lead={<Stamp color={p.color} emoji={p.emoji} name={p.name} size="md" />}
          title={p.name}
          subtitle={p.subtitle}
          amount={<MoneyDisplay amount={p.used} currency={p.currency} size="inline" />}
          meta={formatPercent(barPct(p.used, p.budget))}
        />
      }
    >
      {p.prorated ? <p className="text-xs text-muted-foreground tabular-nums">{p.prorated}</p> : null}
      <div className="flex items-center gap-3">
        <RuleMeter
          className="flex-1"
          used={used}
          total={total}
          near={p.status === "approaching"}
          pct={p.budget > 0 ? (p.used / p.budget) * 100 : undefined}
          label={t("meterLabel", { name: p.name })}
          overLabel={t("statusOver")}
        />
        <BudgetStatusMark status={p.status} overLabel={t("statusOver")} nearLabel={t("statusApproaching")} />
      </div>
      <div className="flex items-center gap-1">
        <Input
          key={p.inputKey}
          type="number"
          step="0.01"
          min="0"
          defaultValue={p.defaultAmount || ""}
          placeholder={p.placeholder}
          aria-label={p.budgetAria}
          className="h-8 flex-1 tabular-nums"
          onBlur={(e) => p.onSave(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {p.editControl}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={p.deleteAria}
          className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
          onClick={p.onDelete}
          disabled={p.deleting}
          isLoading={p.deleting}
        >
          {p.deleting ? null : <Trash2 className="size-4" />}
        </Button>
      </div>
    </LedgerBlock>
  );
}
```
Add the three keys to both catalogues under `Budgets` (values above).

- [ ] **Step 4: Run to verify it passes, plus types and parity**

Run: `npx vitest run components/budgets lib/i18n 2>&1 | tail -5; npx tsc --noEmit 2>&1 | head`
Expected: PASS and no type errors. `BudgetLine` has no callers yet, which is expected until Tasks 4-5.

- [ ] **Step 5: Commit**

```bash
git add components/budgets messages
git commit -m "feat(budgets): a shared BudgetLine and a status mark that never rides on colour

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `/budgets` categories, the peso Note, and the page

**Files:**
- Create: `components/budgets/budget-note.tsx`
- Modify: `components/budgets/budget-grid.tsx` (rewrite the render; every handler stays), `app/(app)/budgets/page.tsx`, `app/(app)/budgets/loading.tsx`

**Interfaces:**
- Consumes: `BudgetLine`, `SectionLegend`, `DoubleRule`, `Note`, `MoneyDisplay`, `periodSerial`, `fitFigureClass`, `PeriodPicker`.
- Produces: `BudgetNote({ totalBudget, totalUsed, currency, periodStart })`; `BudgetGrid` gains an optional `groupBand?: React.ReactNode` prop, rendered between the Note and the category band.

- [ ] **Step 1: Write `BudgetNote`**

`components/budgets/budget-note.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Note } from "@/components/papel/note";
import { MoneyDisplay } from "@/components/ui/money-display";
import { periodSerial } from "@/lib/overview/period-serial";
import { fitFigureClass } from "@/lib/papel/fit";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The period's budget total, printed on the screen's one (peso) note. Used and
 * remaining sit under it as ruled lines. Overspend is the minus sign and the
 * heading it reads under, never a red figure: red on peso fails contrast, and
 * state must not ride on colour.
 */
export function BudgetNote({
  totalBudget,
  totalUsed,
  currency,
  periodStart,
}: {
  totalBudget: number;
  totalUsed: number;
  currency: string;
  periodStart: string;
}) {
  const t = useTranslations("Budgets");
  const remaining = totalBudget - totalUsed;
  const figureClass = cn(fitFigureClass(formatMoney(totalBudget, currency)), "[font-stretch:125%] font-extrabold");
  return (
    <Note tone="peso" label={t("budgetLabel")} serial={periodSerial(periodStart)}>
      <MoneyDisplay amount={totalBudget} currency={currency} size="hero" className={figureClass} />
      <div className="mt-5 space-y-1.5 border-t border-current/30 pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="opacity-90">{t("usedLabel")}</span>
          <MoneyDisplay amount={totalUsed} currency={currency} size="inline" />
        </div>
        <div className="flex items-baseline justify-between gap-4 font-semibold">
          <span>{t("remainingLabel")}</span>
          <MoneyDisplay amount={remaining} currency={currency} size="inline" />
        </div>
      </div>
    </Note>
  );
}
```
Before relying on the negative case, confirm `MoneyDisplay` prints a leading minus for a negative amount (`sed -n 36,80p components/ui/money-display.tsx`). If it prints an absolute value, print the sign in the `BudgetNote` row explicitly (`{remaining < 0 ? "−" : ""}` before the figure, using `Math.abs`).

- [ ] **Step 2: Rewrite `BudgetGrid`'s render**

Keep every hook, handler and import that survives (`onSaveBudget`, `onDelete`, `onCopy`, `navigate`, `deletingId`, the skeleton branch, the uncategorised line, the `EmptyState`). Remove the imports `Card`'s old use only if unused, `ColorTile`, `StatPill`, `STATUS_COLOR`, `Input`, `Trash2`, `formatPercent`, `MoneyDisplay`. Replace the returned JSX with:
```tsx
  return (
    <section className="space-y-6">
      {/* The picker and the copy action are a plain toolbar, not a card: the
          Note below is the period's one framed object. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <PeriodPicker
          period={period}
          mode={mode}
          payCycle={payCycle}
          payAnchor={payAnchor}
          locale={locale}
          pending={navPending}
          onNavigate={navigate}
        />
        <Button variant="outline" size="sm" onClick={onCopy} disabled={pending || navPending} isLoading={pending}>
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
      </div>

      {navPending ? (
        <div className="skeleton h-44 rounded-[6px]" />
      ) : rows.length > 0 ? (
        <BudgetNote totalBudget={totalBudget} totalUsed={totalUsed} currency={baseCurrency} periodStart={period.start} />
      ) : null}

      {!navPending && overview.uncategorized > 0 ? (
        /* unchanged uncategorised paragraph */
      ) : null}

      {groupBand}

      <div className="space-y-4">
        <SectionLegend>{t("sectionTitle")}</SectionLegend>
        {navPending ? (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<PieChart className="size-6" />} title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            {rows.map((row) => {
              const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
              return (
                <BudgetLine
                  key={row.category_id}
                  name={row.name}
                  color={row.color}
                  emoji={row.emoji}
                  used={row.used}
                  budget={row.budget}
                  status={row.status}
                  currency={baseCurrency}
                  subtitle={t("amountOfBudget", {
                    used: maskedFormatMoney(row.used, baseCurrency),
                    budget: maskedFormatMoney(row.budget, baseCurrency),
                  })}
                  prorated={
                    parts.prorated !== null
                      ? t(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                          monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                          prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                        })
                      : null
                  }
                  inputKey={`${row.category_id}-${row.budget_monthly}`}
                  defaultAmount={row.budget_monthly}
                  placeholder={t("amountPlaceholder")}
                  budgetAria={t("budgetForAria", { name: row.name })}
                  onSave={(raw) => onSaveBudget(row.category_id, raw, row.budget_monthly)}
                  editControl={
                    <CategoryDialog
                      mode="edit"
                      category={row}
                      groups={groups}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("editAria", { name: row.name })}
                          className={cn("text-muted-foreground", TOUCH_TARGET)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  }
                  deleteAria={t("deleteAria", { name: row.name })}
                  onDelete={() => onDelete(row.category_id)}
                  deleting={deletingId === row.category_id}
                />
              );
            })}
          </Card>
        )}
      </div>
    </section>
  );
```
Add `groupBand?: React.ReactNode` to the props (documented: "the group band, rendered by the page, so the Note leads the page and the picker still lives with the categories"). Keep the existing long comments that still apply (the touch-target one). Drop the old comment block about the month switcher's totals row, which no longer exists.

- [ ] **Step 3: Update the page and loading state**

In `app/(app)/budgets/page.tsx`: remove the standalone `<GroupGrid overview={groupOverview} payCycle={payCycle} />` and pass it in: `groupBand={<GroupGrid overview={groupOverview} payCycle={payCycle} />}` on `<BudgetGrid>`. Replace `<Separator />` with `<DoubleRule />` (import from `@/components/papel/double-rule`; remove the `Separator` import). Update the stale comment above `GroupGrid`/`BudgetGrid` to describe the new order: toolbar, Note, groups, categories, double rule, goals.

In `app/(app)/budgets/loading.tsx`: mirror the new shape: toolbar row (`skeleton h-8`), a `skeleton h-44 rounded-[6px]` note, then 5 `skeleton h-24` rows, a `DoubleRule`, and the goals block (heading rule + 3 `skeleton h-32`); replace `Separator` with `DoubleRule`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | head; npx eslint components/budgets app/\(app\)/budgets; npx vitest run components/budgets lib/budgets`
Expected: clean. Then read `git --no-pager diff --stat` and confirm no handler was deleted (`onSaveBudget`, `onDelete`, `onCopy`, `navigate` all still present).

- [ ] **Step 5: Commit**

```bash
git add components/budgets "app/(app)/budgets"
git commit -m "style(budgets): the period total is a peso note and categories are ruled budget lines

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Budget groups onto BudgetLine

**Files:**
- Modify: `components/budgets/group-grid.tsx`

**Interfaces:**
- Consumes: `BudgetLine`, `SectionLegend`, `Card`.

- [ ] **Step 1: Rewrite the render**

Keep `useTranslations("BudgetGroups")` as `t` and `Budgets` as `tb`, all handlers, the `periodLabel`, the early `return null` (below every hook), and the long doc comment above the component (update its "same tile, same figure, same pill, same bar" sentence to "same `BudgetLine`"). Replace the imports `Input`, `ColorTile`, `MoneyDisplay`, `StatPill`, `STATUS_COLOR`, `barPct`, `formatPercent`, `Trash2` with `BudgetLine`, `SectionLegend`. Replace the returned JSX with:
```tsx
  return (
    <section className="space-y-4">
      <SectionLegend aside={<span>{periodLabel}</span>}>{t("sectionTitle")}</SectionLegend>
      <Card className="gap-0 overflow-hidden p-0">
        {rows.map((row) => {
          const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
          return (
            <BudgetLine
              key={row.budget_group_id}
              name={row.name}
              color={row.color}
              emoji={row.emoji}
              used={row.used}
              budget={row.budget}
              status={row.status}
              currency={baseCurrency}
              subtitle={t("amountOfBudget", {
                used: maskedFormatMoney(row.used, baseCurrency),
                budget: maskedFormatMoney(row.budget, baseCurrency),
              })}
              prorated={
                parts.prorated !== null
                  ? tb(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                      monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                      prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                    })
                  : null
              }
              inputKey={`${row.budget_group_id}-${row.budget_monthly}`}
              defaultAmount={row.budget_monthly}
              placeholder={t("amountPlaceholder")}
              budgetAria={t("budgetForAria", { name: row.name })}
              onSave={(raw) => onSaveBudget(row.budget_group_id, raw, row.budget_monthly)}
              editControl={
                <GroupDialog
                  mode="edit"
                  group={row}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("editAria", { name: row.name })}
                      className={cn("text-muted-foreground", TOUCH_TARGET)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
              }
              deleteAria={t("deleteAria", { name: row.name })}
              onDelete={() => onDelete(row.budget_group_id)}
              deleting={deletingId === row.budget_group_id}
            />
          );
        })}
      </Card>
    </section>
  );
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | head; npx eslint components/budgets; npx vitest run components/budgets`
Expected: clean. `grep -n "ColorTile\|StatPill\|STATUS_COLOR" components/budgets/*.tsx` returns nothing.

- [ ] **Step 3: Commit**

```bash
git add components/budgets
git commit -m "style(budgets): the group band prints through the same BudgetLine as categories

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Goals (strip, pace verdict, grid, detail, contributions)

**Files:**
- Create: `components/goals/goal-strip.tsx` (+ `goal-strip.test.tsx`)
- Modify: `components/goals/goal-progress.tsx`, `components/goals/goal-grid.tsx`, `components/goals/contributions-list.tsx`, `app/(app)/budgets/goals/[id]/page.tsx`, `messages/en.json`, `messages/es.json` (`Goals.stripLabel`)

**Interfaces:**
- Consumes: `goalStripCells`, `goalProgressPct` (stays exported from `goal-progress.tsx`), `LedgerBlock`, `LedgerRow`, `Stamp`, `SectionLegend`, `ProofMark`.
- Produces: `GoalStrip({ goal: GoalCardRow; decorative?: boolean })`, which replaces `GoalBar` (delete `GoalBar` from `goal-progress.tsx`, moving its arrival-burst logic verbatim into `GoalStrip`). New key `Goals.stripLabel` with `{pct}`: en "{pct}% saved", es "{pct}% ahorrado". Confirm it is absent first with grep.

- [ ] **Step 1: Write the failing test**

`components/goals/goal-strip.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/sound/sound-provider", () => ({ useUiSound: () => ({ playSuccess: () => {} }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string, v?: { pct?: number }) => `${k}:${v?.pct ?? ""}` }));

import { GoalStrip } from "./goal-strip";

const goal = { saved: 500, backed: 300, target_amount: 1000 } as never;

describe("GoalStrip", () => {
  it("draws twenty cells", () => {
    expect((renderToStaticMarkup(<GoalStrip goal={goal} />).match(/<i /g) ?? []).length).toBe(20);
  });
  it("reads as an image with the saved percentage by default", () => {
    const html = renderToStaticMarkup(<GoalStrip goal={goal} />);
    expect(html).toContain('role="img"');
    expect(html).toContain("stripLabel:50");
  });
  it("drops the image role when a visible caption already says it", () => {
    const html = renderToStaticMarkup(<GoalStrip goal={goal} decorative />);
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-hidden="true"');
  });
  it("marks borrowed-back cells so a hollowed goal is visible without colour", () => {
    expect(renderToStaticMarkup(<GoalStrip goal={goal} />)).toContain("data-cell=\"borrowed\"");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/goals/goal-strip.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `GoalStrip`**

`components/goals/goal-strip.tsx` moves `GoalBar`'s effect block over unchanged (the `wasReached` ref seeded at mount, `burstRef`, `soundRef`, the remove-class / reflow / add-class trick and `playSuccess`), keeping its explanatory comments. Only the drawn output changes:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { goalStripCells } from "@/lib/goals/strip";
import { goalProgressPct } from "./goal-progress";
import type { GoalCardRow } from "@/lib/goals/queries";
import { cn } from "@/lib/utils";

/** Cell looks. Solid = backed by real money; borrowed = hatched, so a goal
 *  spent into reads hollow; empty = dashed outline. All in ink: the goal's
 *  own colour lives on its Stamp, never on the strip. */
const CELL: Record<"solid" | "borrowed" | "empty", string> = {
  solid: "bg-foreground",
  borrowed: "bg-[repeating-linear-gradient(135deg,var(--ink)_0_1.5px,transparent_1.5px_4px)]",
  empty: "border-dashed opacity-60",
};

export function GoalStrip({ goal, decorative }: { goal: GoalCardRow; decorative?: boolean }) {
  const t = useTranslations("Goals");
  const pct = goalProgressPct(goal);
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;
  const cells = goalStripCells(pct, backedShare);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;

  /* wasReached / burstRef / soundRef and the two effects: moved verbatim from
     the old GoalBar. */

  return (
    <div className="relative mt-3">
      <div
        role={decorative ? undefined : "img"}
        aria-hidden={decorative ? true : undefined}
        aria-label={decorative ? undefined : t("stripLabel", { pct: Math.round(pct) })}
        className="flex gap-1"
      >
        {cells.map((kind, i) => (
          <i
            key={i}
            data-cell={kind}
            className={cn("h-3 flex-1 rounded-[1px] border border-foreground", CELL[kind])}
          />
        ))}
      </div>
      <span
        ref={burstRef}
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[2px] border-2 border-foreground opacity-0"
      />
    </div>
  );
}
```
`goalProgressPct` lives in `goal-progress.tsx`, which must not import `GoalStrip` back (no cycle). In `goal-progress.tsx`: delete `GoalBar` and its now-unused imports (`useEffect`, `useRef`, `useUiSound`), keep `goalProgressPct`. Change `PaceSummary`'s verdict from `StatPill` to `ProofMark`:
```tsx
const PACE_TONE = { success: "ok", warning: "flag", destructive: "flag" } as const;
// ...
{status ? (
  <ProofMark tone={PACE_TONE[status.tone]} className="ms-auto shrink-0">
    {status.label}
  </ProofMark>
) : null}
```
Update that function's doc comment ("becomes a chip" → "prints as a proof mark; the glyph and the label carry the state, colour only reinforces it"), and drop the `StatPill` import. Add `Goals.stripLabel` to both catalogues.

- [ ] **Step 4: Rebuild `GoalGrid` as ledger blocks**

Keep every hook, `onDelete`, `confirmGoal`, the confirmation `Dialog`, `EmptyState` and the totals paragraph (keep `tabular-nums`, keep the borrowed span; drop only `text-destructive`, replacing the span with plain text so the minus and the word carry it, since the leading `·` and the label already state it). Replace the section head and the grid with:
```tsx
    <section className="space-y-4">
      <SectionLegend
        aside={
          <GoalDialog trigger={<Button size="sm"><Plus className="size-4" />{t("addGoal")}</Button>} />
        }
      >
        {t("sectionTitle")}
      </SectionLegend>
      {/* totals paragraph, unchanged */}
      {goals.length === 0 ? (
        <EmptyState /* unchanged */ />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          {goals.map((goal) => (
            <LedgerBlock
              key={goal.id}
              head={
                <LedgerRow
                  lead={<Stamp color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />}
                  title={
                    <Link href={`/budgets/goals/${goal.id}`} className="hover:underline">
                      {goal.name}
                    </Link>
                  }
                  subtitle={t("amountOfTarget", {
                    saved: formatMoney(goal.saved, baseCurrency),
                    target: formatMoney(goal.target_amount, baseCurrency),
                  })}
                  amount={<MoneyDisplay amount={goal.saved} currency={baseCurrency} size="inline" />}
                  meta={formatPercent(goalProgressPct(goal))}
                />
              }
            >
              <GoalStrip goal={goal} decorative />
              <PaceSummary pace={goal.pace} currency={baseCurrency} className="min-h-6 text-xs" />
              {/* Contribute / edit / delete: the existing row, unchanged. */}
              <div className="flex items-center gap-1">{/* ContributeDialog, GoalDialog edit, delete button as before */}</div>
            </LedgerBlock>
          ))}
        </Card>
      )}
      {/* confirmation Dialog, unchanged */}
    </section>
```
Imports: drop `ColorTile`, `StatPill`, `GoalBar`; add `Stamp`, `LedgerBlock`, `LedgerRow`, `SectionLegend`, `GoalStrip`, `MoneyDisplay` stays. The `Link` title must still truncate: `LedgerRow`'s title wrapper is `truncate`, and an inline `Link` inside it truncates with it.

- [ ] **Step 5: Goal detail page and contributions**

`app/(app)/budgets/goals/[id]/page.tsx`: `ColorTile` → `<Stamp color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />`, `GoalBar` → `<GoalStrip goal={goal} />` (labelled: the page shows the amounts but not the percent), keep the balance chart `Card` as is (Phase 5 redraws charts), keep `ContributionsList`.

`components/goals/contributions-list.tsx`: keep every hook, `onDelete`, the confirmation `Dialog` and the empty state. Replace the `Card`'s `ul` with a sheet of ledger rows and the outer `Card` with a `SectionLegend` heading over one hairline sheet:
```tsx
    <section className="space-y-4">
      <SectionLegend aside={<ContributeDialog goal={goal} accounts={accounts} baseCurrency={baseCurrency} trigger={<Button size="sm">{tg("contribute")}</Button>} />}>
        {t("contributionsTitle")}
      </SectionLegend>
      {contributions.length === 0 ? (
        <EmptyState /* unchanged, minus className="mt-4" */ />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          {contributions.map((c) => (
            <LedgerRow
              key={c.id}
              lead={<span className="figure w-14 shrink-0 text-xs text-muted-foreground">{formatDate(c.occurred_at.slice(0, 10), locale)}</span>}
              title={c.account_name}
              amount={
                <span className="text-sm">
                  {formatMoney(c.amount, c.currency, { signed: true })}
                </span>
              }
              trailing={/* the existing delete Button, unchanged */}
            />
          ))}
        </Card>
      )}
      {/* confirmation Dialog, unchanged */}
    </section>
```
A withdrawal is negative and already prints `−` through `formatMoney(..., { signed: true })`, so drop the `text-destructive` class: the sign carries it. Keep `cn` only if still used.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit 2>&1 | head; npx eslint components/goals "app/(app)/budgets/goals"; npx vitest run components/goals lib/goals`
Expected: clean and PASS. `grep -rn "GoalBar\|ColorTile\|StatPill" components/goals app/\(app\)/budgets` returns nothing. Then, after Task 8's screenshot round, watch that goal completion still bursts once on arrival, not on load.

- [ ] **Step 7: Commit**

```bash
git add components/goals "app/(app)/budgets/goals" messages
git commit -m "style(goals): goals print as ruled blocks with a perforated progress strip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Recurring ledger, and the dialogs audit

**Files:**
- Modify: `components/subscriptions/subscriptions-view.tsx`, `app/(app)/recurring/loading.tsx`
- Audit (edit only what the checks below flag): `components/budgets/{category-dialog,group-dialog}.tsx`, `components/goals/{goal-dialog,contribute-dialog}.tsx`, `components/subscriptions/{subscription-form-dialog,record-charge-dialog}.tsx`

**Interfaces:**
- Consumes: `orderByNext`, `LedgerBlock`, `LedgerRow`, `SectionLegend`, `DoubleRule`, `MoneyDisplay`.

- [ ] **Step 1: Rewrite `SubscriptionsView`'s render**

Keep every hook, handler (`onAddCharge`, `onDelete`, `onToggle`), `totals`, `nextLabel`, `accountLine`, `AddSubscriptionControl`, `ChargeButton` and the `BrandMark` doc comment. Two edits to `BrandMark`: remove the `tile-sheen` utility and add `ring-1 ring-(--rule)` to `shared` (the sheen is a named incumbent to retire; a hairline ring keeps a pale brand colour from dissolving into paper), and update its comment to say so. Replace `incomeSubs` / `otherSubs` with the ordered lists:
```tsx
  const incomeSubs = orderByNext(subscriptions.filter((s) => s.kind === "income"));
  const otherSubs = orderByNext(subscriptions.filter((s) => s.kind !== "income"));
```
Replace `renderCard` with `renderBlock` returning a `LedgerBlock`:
```tsx
  const renderBlock = (sub: SubscriptionWithRefs) => {
    const monthly = monthlyEquivalent(sub.amount, sub.billing_cycle as BillingCycle);
    return (
      <LedgerBlock
        key={sub.id}
        className={cn(!sub.is_active && "opacity-60")}
        head={
          <LedgerRow
            lead={<BrandMark name={sub.name} color={sub.color} logoPath={sub.logoPath} />}
            title={sub.name}
            subtitle={`${sub.kind !== "expense" ? `${tType(sub.kind)} · ` : ""}${tCycle(sub.billing_cycle as BillingCycle)}`}
            amount={<MoneyDisplay amount={sub.amount} currency={sub.currency} size="inline" />}
            meta={t("nextPrefix", { date: nextLabel(sub) })}
          />
        }
      >
        {monthly !== sub.amount ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t.rich("monthlyEquivalent", {
              amount: () => <MaskedMoney amount={monthly} currency={sub.currency} />,
            })}
          </p>
        ) : null}
        {accountLine(sub) ? <p className="truncate text-xs text-muted-foreground">{accountLine(sub)}</p> : null}
        {/* The control row, unchanged in content and order: Switch, edit and
            delete on the left, Record at the right edge. */}
        <div className="flex items-center justify-between gap-2">
          {/* Switch + SubscriptionFormDialog edit + delete Button, then ChargeButton, exactly as before */}
        </div>
      </LedgerBlock>
    );
  };
```
The delete button's `pending` flag is shared, as today (do not change that behaviour). Replace the returned JSX:
```tsx
  return (
    <div className="space-y-6">
      {/* Plain ruled totals, no note: this screen is read and edited
          repeatedly. Money out and money in are peers at one size. Income
          is teal and also carries its own label, so colour never alone. */}
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 border-y-2 border-(--rule) py-4">
        <div>
          <p className="legend text-[11px] text-muted-foreground">{t("monthlyRecurring")}</p>
          <p className="mt-1 leading-none text-foreground">
            <MoneyDisplay amount={totals.outgoing} currency={data.baseCurrency} size="feature" />
          </p>
        </div>
        {incomeSubs.length > 0 && (
          <div>
            <p className="legend text-[11px] text-muted-foreground">{t("monthlyIncome")}</p>
            <p className="mt-1 leading-none text-(--teal)">
              <MoneyDisplay amount={totals.income} currency={data.baseCurrency} size="feature" />
            </p>
          </div>
        )}
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState /* unchanged */ />
      ) : (
        <div className="space-y-6">
          {showBands && (
            <div className="space-y-3">
              <SectionLegend>{t("sectionIncome")}</SectionLegend>
              <Card className="gap-0 overflow-hidden p-0">{incomeSubs.map(renderBlock)}</Card>
            </div>
          )}
          {showBands && <DoubleRule />}
          <div className="space-y-3">
            {showBands && <SectionLegend>{t("sectionOther")}</SectionLegend>}
            <Card className="gap-0 overflow-hidden p-0">
              {(showBands ? otherSubs : orderByNext(subscriptions)).map(renderBlock)}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
```
Remove now-unused imports (`Switch` stays; drop none that are still used; add `LedgerBlock`, `LedgerRow`, `SectionLegend`, `DoubleRule`, `orderByNext`). The `nextLabel` `dateFmt` is `en-US`-only today; leave that behaviour alone (out of scope) but do not copy it into new code.

`app/(app)/recurring/loading.tsx`: keep the header block; replace the `h-20` and grid with a `skeleton h-20` totals strip and one hairline sheet of 5 `skeleton h-24` rows, `max-w-5xl` → `max-w-3xl` only if the page itself is changed to `max-w-3xl` (do so in the page: a ledger reads better narrow; change `app/(app)/recurring/page.tsx` `max-w-5xl` to `max-w-3xl` and the loading file to match).

- [ ] **Step 2: Dialogs audit**

Run, and act on what each returns:
```bash
grep -n "rounded-full\|bg-muted\|ColorTile\|StatPill\|tile-sheen\|shadow" \
  components/budgets/category-dialog.tsx components/budgets/group-dialog.tsx \
  components/goals/goal-dialog.tsx components/goals/contribute-dialog.tsx \
  components/subscriptions/subscription-form-dialog.tsx components/subscriptions/record-charge-dialog.tsx
```
Rules for what to change, and only this: (a) a segmented or pill control that selects a type or mode becomes the ruled type strip already built for the transaction form (find it with `grep -rn "type strip\|TypeStrip\|ruled" components/transactions/transaction-form.tsx`); (b) any `ColorTile` or `StatPill` becomes `Stamp` or `ProofMark`; (c) any shadow or gradient goes. Colour and emoji pickers stay: they are the picker of user data. Do not restructure fields, validation or submit flow. If the grep returns nothing that violates (a)-(c), record that in the commit body and change no dialog file.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | head; npx eslint components/subscriptions components/budgets components/goals "app/(app)/recurring"; npx vitest run components lib/subscriptions`
Expected: clean and PASS. `grep -rn "tile-sheen\|StatPill\|ColorTile" components/subscriptions` returns nothing.

- [ ] **Step 4: Commit**

```bash
git add components/subscriptions "app/(app)/recurring" components/budgets components/goals
git commit -m "style(recurring): subscriptions print as a ledger by next charge date

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Help guide (mocks and copy in en + es)

**Files:**
- Modify: `components/help/mocks.tsx` (`BudgetsMock`, `BudgetGroupsMock`, `SubscriptionsMock`), `app/(app)/help/page.tsx`, `messages/en.json`, `messages/es.json` (`Help.*`), `lib/budgets/bar.ts` (delete `STATUS_COLOR` once unreferenced)

**Interfaces:**
- Consumes: `Note`, `LedgerBlock`, `LedgerRow`, `Stamp`, `RuleMeter`, `BudgetStatusMark`, `SpecimenFrame`, `SectionLegend`, `DoubleRule`.

- [ ] **Step 1: Rebuild the three mocks from the live primitives**

Read `LedgerMock` (`sed -n 431,517p components/help/mocks.tsx`) and copy its `SpecimenFrame` wrapper and label idiom exactly. Then:
- `BudgetsMock`: inside a `SpecimenFrame`, a small peso `Note` (`tone="peso"`, `ornament={false}`, label = the month prop, figure = specimen total `RD$ 890`), then three `BudgetLine`-shaped blocks built directly from `LedgerBlock` + `LedgerRow` + `Stamp` + `RuleMeter` + `BudgetStatusMark` (do not render `BudgetLine` itself: it needs client `useTranslations` and inputs). One row per state: `within` (68%), `approaching` (84%, `near`) and `over` (140%, over). Pass the already-translated labels in as props from `help/page.tsx`: add props `nearLabel`, `overLabel`, `usedOf`.
- `BudgetGroupsMock`: same drawing for the three groups, no Note, all `within`/`approaching`, a `SectionLegend` heading.
- `SubscriptionsMock`: a `SectionLegend`, then two `LedgerBlock`s ordered by next date, the Spotify brand disc (no `tile-sheen`) and the paused transfer at 60% opacity, with the same Record button.
- Keep the specimen-data rule: every specimen figure sits inside `SpecimenFrame` and is labelled as an example. Remove `ColorTile`, `StatPill`, `STATUS_COLOR` and `Card` imports left unused.

- [ ] **Step 2: Update the chapter copy**

In `app/(app)/help/page.tsx` pass the new props. In `messages/en.json` and `messages/es.json` update the `Help.*` strings that describe how these screens look, and only those: `budgetsProgress` (the meter now shows Near and Over as a tag and a flag mark, not a colour), `budgetsHeader` (the peso note carries the period total, used and remaining), the goals bullet if one names bars or colours, and `subViews` (recurring is one ledger ordered by next charge date, income above the double rule). Add any new key to both catalogues. Bank terms stay Spanish.

- [ ] **Step 3: Verify and remove dead code**

Run:
```bash
grep -rn "STATUS_COLOR" --include=*.ts --include=*.tsx . 2>/dev/null | grep -v node_modules
```
If the only hit is its own definition in `lib/budgets/bar.ts`, delete `STATUS_COLOR` and its `BudgetStatus` import (keep `barPct` and `meterArgs`). Then `npx tsc --noEmit 2>&1 | head; npx eslint components/help "app/(app)/help"; npx vitest run` (the full suite, which includes i18n key parity if a parity test exists; otherwise run `node -e` to diff key sets of `messages/en.json` and `messages/es.json` and expect no difference).

- [ ] **Step 4: Commit**

```bash
git add components/help "app/(app)/help" messages lib/budgets
git commit -m "docs(help): Budgets, groups and Recurring chapters and mocks match the ledger

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Review round, DESIGN.md and close-out

**Files:**
- Modify: `DESIGN.md`, `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md`
- Screenshots go to the scratchpad directory only.

- [ ] **Step 1: Ask, then run one batched screenshot round**

Ask the user before starting a dev server (memory: dev-server-confirmation). On yes: `pgrep -af 'next dev'` first and reuse a running one; otherwise start one with `run_in_background` on a fixed port with `NODE_OPTIONS=--max-old-space-size=6144`. Use the remote-Supabase auth workaround from memory `browser-verification-setup`. With `agent-browser --session "$(agent-browser session id --scope worktree --prefix tywin)"`, capture `/budgets`, `/budgets/goals/<id>` and `/recurring` at 1280 desktop and 360x780 mobile, light and dark, `es`, with: a peso budget with mixed within / near / over rows, a group, a goal with borrowed cells, a completed goal, and a paused template. Check against the constraints: one Note, no colour-only state, 360px truncation on long Spanish names, row density, contrast on the peso Note in both themes, and that a goal already complete on load does not burst. Fix everything in one batch, confirm with at most one more round. Then stop the server (`TaskStop` or kill its PID and children), `pgrep -af 'next dev|node'` to confirm, and `agent-browser close`.

- [ ] **Step 2: Detector, reviewer, documenter**

Run `node .claude/skills/impeccable/scripts/detect.mjs` on the changed files, fix findings, then dispatch the `impeccable-finish-reviewer` and the `impeccable-documenter` (or, if those agents are not available in this session, review against `craft-floor.md` by hand and extend DESIGN.md yourself). Then `/impeccable audit` for a11y, performance and responsive on `/budgets`, the goal detail page and `/recurring`, and `polish`.

- [ ] **Step 3: Extend DESIGN.md**

Add a "Budgets, Goals and Recurring (Phase 4)" subsection after "Transactions and Imports (Phase 3)" covering: the peso `Note` carries the period budget total with used and remaining as ruled lines and is skipped with no category rows; `BudgetLine` and the status vocabulary (within = nothing, approaching = `Mark` + heavy meter rule, over = flag `ProofMark` + red fill + double-rule end cap); groups and categories share `BudgetLine`; `GoalStrip` (20 cells: solid, hatched borrowed, dashed remaining, ink only, the goal's colour lives on its Stamp) and the `PaceSummary` `ProofMark` mapping; recurring's ledger ordered by next date with income above a `DoubleRule`; the new `LedgerBlock`, `DoubleRule`, `SectionLegend` and `RuleMeter near`. Update the primitives table row for **Ledger row** (now also used by Budgets, Goals and Recurring), **Rule meter** and **Perforation strip** if it names pending phases. In "Pending, not yet migrated": recount `ColorTile` and `StatPill` callers with
```bash
grep -rln "ColorTile\|StatPill" components app | grep -v "components/ui/"
```
and write the true number; remove "Budgets, Goals, Recurring (Phase 4)" from the screens-on-old-layouts line and add `BudgetsMock`, `BudgetGroupsMock` and `SubscriptionsMock` to the done mocks; drop `.tile-sheen` from the "incumbent" list only if `grep -rn tile-sheen components app` shows no remaining caller.

- [ ] **Step 4: Tick the master plan and finish**

In `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md` mark Phase 4's task checkboxes done, matching how Phase 3's were marked. Run the full gate: `npx tsc --noEmit && npx eslint . && npx vitest run`, and `npx next build` if the user agrees (it is heavy on this machine; otherwise say it was not run). Confirm the state with `git --no-pager status --short` and `git --no-pager log --oneline -12` (everything is on `main`, no branch to merge or delete).

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md docs
git commit -m "docs(design): record Phase 4 (Budgets, Goals, Recurring) in DESIGN.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Then ask the user whether to push `main` (do not push unprompted; memory: the user verifies deploys themselves).

---

## Self-review (run against the spec and the confirmed brief)

- **Spec coverage.** Period total as peso note: Task 4. Categories as rule meters with the user's stamp: Tasks 3 and 4. Groups as ruled sections: Tasks 4 and 5 (`SectionLegend`, sheet). Goals with perforation strips for contributions: Task 6 (`GoalStrip`, cell grammar). Recurring ledger by next date, income and expense separated by a double rule: Task 7. Help guide in en + es, DESIGN.md, key parity, one review round: Tasks 8 and 9. Alias retirement (`ColorTile`, `StatPill` callers): Tasks 5-8, recounted in Task 9. Status vocabulary (the brief's open decision): resolved under "Locked composition".
- **Placeholder scan.** No "TBD" or "similar to". Three places say "unchanged" or "moved verbatim" (the goal-completion effect block, the confirmation dialogs, the goal action row) because copying 60 lines of untouched, behaviour-critical code into the plan would only invite a transcription error; the executor moves it byte for byte and Step 6's grep proves nothing was left behind.
- **Type consistency.** `meterArgs`, `goalStripCells`, `orderByNext`, `BudgetLineProps`, `BudgetStatusMark`, `GoalStrip({ goal, decorative })`, `LedgerBlock({ head, children })`, `SectionLegend({ children, aside })`, `RuleMeter near` are named the same everywhere they are produced and consumed.
- **Known judgement calls to confirm at review:** Behind-pace uses the red flag glyph because Papel has no amber; the peso Note prints overspend as a minus, not red; Recurring narrows to `max-w-3xl`.
