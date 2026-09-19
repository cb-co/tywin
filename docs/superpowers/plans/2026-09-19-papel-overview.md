# Papel Overview (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skill:** every UI task runs under `/impeccable`. Load `.claude/skills/impeccable/reference/craft-floor.md` before editing UI.

**Goal:** Recompose the signed-in Overview (`app/(app)/page.tsx`) into the Papel Moneda world, using the **cheque stub** composition the user locked.

**Architecture:** One peso `Note` carries the Disponible figure, the net-worth line and a quincena timeline engraved on its bottom edge. A dashed perforation joins it to the "Este período" stub, a ruled table of three figures. Below that come a margin-note coach tip, a baseline-rule Ask input, and Upcoming as `LedgerRow`s. All building blocks are the Phase 0 primitives in `components/papel/`. Three small pure functions (serial, progress, figure fit) are built test-first. No new primitive is added.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, next-intl, Vitest (`renderToStaticMarkup` for component tests).

**Spec:** `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` (§5 states, §6 Overview). Parent plan: `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md`, Task 12. Locked comp: **cheque stub** (decision page, wireframe): note + quincena edge, perforation, three-figure stub, then margin note + Ask, then Upcoming.

## Global Constraints

- Tokens verbatim from DESIGN.md. Note fields never invert. **At most one Note per screen.** Guilloche, microprint and serials only on the Note, never on rows or forms.
- State by ink density, rule weight or glyph, never colour alone. Text is never set in a user hex.
- WCAG 2.2 AA: 4.5:1 body text, keyboard-complete, 2px currentColor focus outline, `prefers-reduced-motion` honoured.
- i18n: no hardcoded copy; **en and es change together**. Microprint and bank terms (quincena, cuotas) stay Spanish. The help guide (page, mocks, en and es) is updated in this phase.
- No database migration. Screen logic, queries, server actions, routes and existing message keys stay; keys may be added, never silently replaced.
- Keep the mobile fixes: safe-area insets, `min-w-0` on the shell column, 360px Spanish truncation, FAB clearance.
- Machine rules: ask before starting a dev server, one server on port 3000 with `run_in_background`, stop it in the same turn, `agent-browser` with a named session, then `agent-browser close`. Verify git with `git --no-pager` (RTK mangles git output).
- Every commit message ends with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Fr53V5wBVhkgSqLiNst1Yp`

## File Structure

**Create**
- `lib/overview/period-serial.ts` (+ `.test.ts`): `periodSerial(start)`.
- `lib/overview/period-progress.ts` (+ `.test.ts`): `periodProgress(period, today)`.
- `lib/papel/fit.ts` (+ `.test.ts`): `fitFigureClass(text)`.
- `components/overview/quincena-edge.tsx` (+ `.test.tsx`): the timeline on the note's bottom edge.
- `components/overview/period-stub.tsx` (+ `.test.tsx`): "Este período" perforated stub.

**Modify**
- `components/overview/available-hero.tsx`: HeroCard becomes a peso Note.
- `components/overview/recommendation-card.tsx`: card becomes a margin note.
- `components/overview/ask-entry.tsx`: card becomes a baseline-rule input.
- `components/overview/import-callout.tsx`: block callout restyled, plus new `EmptyOverviewNote` export.
- `app/(app)/page.tsx`, `app/(app)/loading.tsx`: recomposed.
- `components/help/mocks.tsx` (`OverviewMock`), `app/(app)/help/page.tsx` (only if props change), `messages/{en,es}.json`.

`components/statements/import-button.tsx` is styling-only and stays unless the review finds a mismatch.

---

### Task 1: Pure helpers (serial, progress, figure fit)

**Files:**
- Create: `lib/overview/period-serial.ts`, `lib/overview/period-progress.ts`, `lib/papel/fit.ts` and a `.test.ts` beside each.

**Interfaces:**
- Produces: `periodSerial(start: string): string`, `periodProgress(period: Period, today: string): { day: number; total: number; pos: number }`, `fitFigureClass(text: string): string`.

- [ ] **Step 1: Write the failing tests**

`lib/overview/period-serial.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { periodSerial } from "./period-serial";

describe("periodSerial", () => {
  it("marks a period that starts in the first half of the month A", () => {
    expect(periodSerial("2026-09-01")).toBe("QNA 2026-09 A");
    expect(periodSerial("2026-09-15")).toBe("QNA 2026-09 A");
  });
  it("marks a period that starts on the 16th or later B", () => {
    expect(periodSerial("2026-09-16")).toBe("QNA 2026-09 B");
    expect(periodSerial("2026-09-20")).toBe("QNA 2026-09 B");
  });
});
```

`lib/overview/period-progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { periodProgress } from "./period-progress";

const p = { start: "2026-09-16", end: "2026-09-30" }; // 15 days inclusive

describe("periodProgress", () => {
  it("counts days inclusively and places today on the edge", () => {
    expect(periodProgress(p, "2026-09-16")).toEqual({ day: 1, total: 15, pos: 0 });
    expect(periodProgress(p, "2026-09-30")).toEqual({ day: 15, total: 15, pos: 1 });
    expect(periodProgress(p, "2026-09-23")).toEqual({ day: 8, total: 15, pos: 0.5 });
  });
  it("clamps a today outside the period", () => {
    expect(periodProgress(p, "2026-09-01").day).toBe(1);
    expect(periodProgress(p, "2026-10-05")).toEqual({ day: 15, total: 15, pos: 1 });
  });
  it("survives a one-day period", () => {
    expect(periodProgress({ start: "2026-09-01", end: "2026-09-01" }, "2026-09-01")).toEqual({ day: 1, total: 1, pos: 0 });
  });
});
```

`lib/papel/fit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fitFigureClass } from "./fit";

describe("fitFigureClass", () => {
  it("steps the size down as the figure grows and never returns nothing", () => {
    const sizes = ["RD$ 0.00", "RD$ 12,480.00", "RD$ 1,234,567.89", "RD$ 12,345,678.90"].map(fitFigureClass);
    expect(new Set(sizes).size).toBe(4);
    for (const s of sizes) expect(s).toMatch(/text-/);
  });
  it("gives the same class to figures of the same length", () => {
    expect(fitFigureClass("RD$ 1,000.00")).toBe(fitFigureClass("RD$ 9,999.99"));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/overview/period-serial.test.ts lib/overview/period-progress.test.ts lib/papel/fit.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`lib/overview/period-serial.ts`:
```ts
/** `QNA <yyyy>-<mm> <A|B>`: the serial printed on the Disponible note. A is
 *  the period that starts on the 1st to 15th, B the one starting on the 16th
 *  or later. Read from the period's own start, so an anchored quincena
 *  (5th and 20th) still splits into A and B. */
export function periodSerial(start: string): string {
  const [y, m, d] = start.split("-");
  return `QNA ${y}-${m} ${Number(d) <= 15 ? "A" : "B"}`;
}
```

`lib/overview/period-progress.ts`:
```ts
import type { Period } from "@/lib/period/cycle";

const DAY = 86_400_000;
const days = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Where `today` sits inside a period: 1-based `day`, inclusive `total`, and
 *  `pos` in 0..1 along the timeline. Clamped, so a stale `today` never draws
 *  the marker off the edge. */
export function periodProgress(period: Period, today: string) {
  const total = days(period.start, period.end) + 1;
  const day = Math.min(Math.max(days(period.start, today) + 1, 1), total);
  return { day, total, pos: total > 1 ? (day - 1) / (total - 1) : 0 };
}
```

`lib/papel/fit.ts`:
```ts
/** Tailwind size for the note's denomination figure, by printed length, so
 *  eight digits plus `RD$` scales down on a 360px phone instead of wrapping.
 *  The thresholds are tuned by the 360px capture in the review task. */
export function fitFigureClass(text: string): string {
  const n = text.length;
  if (n <= 9) return "text-5xl sm:text-6xl";
  if (n <= 12) return "text-4xl sm:text-6xl";
  if (n <= 15) return "text-3xl sm:text-5xl";
  return "text-2xl sm:text-4xl";
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run lib/overview/period-serial.test.ts lib/overview/period-progress.test.ts lib/papel/fit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/overview lib/papel
git commit -m "feat(overview): period serial, progress and figure-fit helpers"
```
(append the attribution lines from Global Constraints)

---

### Task 2: QuincenaEdge

**Files:**
- Create: `components/overview/quincena-edge.tsx`, `components/overview/quincena-edge.test.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Overview`)

**Interfaces:**
- Consumes: `periodProgress` (Task 1).
- Produces: `<QuincenaEdge start end today />`, all `string` ISO dates. It renders inside a `Note`, so ink is `currentColor`.

- [ ] **Step 1: Add copy (en and es together)**

In `Overview`, en: `"quincenaEdgeLabel": "Day {day} of {total}, payday {date}"`, `"quincenaToday": "Today"`, `"availableOver": "Committed beyond your balance"`.
es: `"quincenaEdgeLabel": "Día {day} de {total}, día de pago {date}"`, `"quincenaToday": "Hoy"`, `"availableOver": "Comprometido por encima de tu saldo"`.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { QuincenaEdge } from "./quincena-edge";

const html = (today: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QuincenaEdge start="2026-09-16" end="2026-09-30" today={today} />
    </NextIntlClientProvider>,
  );

describe("QuincenaEdge", () => {
  it("reads as one image with the day count and payday", () => {
    const out = html("2026-09-23");
    expect(out).toContain('role="img"');
    expect(out).toMatch(/Day 8 of 15, payday Sep 30/);
  });
  it("places the today marker along the edge", () => {
    expect(html("2026-09-23")).toContain("left:50%");
    expect(html("2026-09-16")).toContain("left:0%");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run components/overview/quincena-edge.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement**

```tsx
"use client";

import { useTranslations, useFormatter } from "next-intl";
import { periodProgress } from "@/lib/overview/period-progress";

/** The quincena engraved along the note's bottom edge: period start, today,
 *  payday. One image for assistive tech (`aria-label`), so the ticks and
 *  captions are decoration. Ink is `currentColor` and the today marker is a
 *  tall tick plus a caption, never colour alone. */
export function QuincenaEdge({ start, end, today }: { start: string; end: string; today: string }) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const { day, total, pos } = periodProgress({ start, end }, today);
  const short = (iso: string) =>
    f.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div role="img" aria-label={t("quincenaEdgeLabel", { day, total, date: short(end) })} className="relative mt-6">
      <div aria-hidden className="relative h-3 border-b border-current">
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            className="absolute bottom-0 w-px bg-current opacity-60"
            style={{ left: `${total > 1 ? (i / (total - 1)) * 100 : 0}%`, height: i === 0 || i === total - 1 ? "0.75rem" : "0.375rem" }}
          />
        ))}
        <i className="absolute bottom-0 h-5 w-0.5 bg-current" style={{ left: `${pos * 100}%` }} />
      </div>
      <div aria-hidden className="legend mt-1.5 flex justify-between text-[10px]">
        <span>{short(start)}</span>
        <span>{short(end)}</span>
      </div>
      <span
        aria-hidden
        className="legend absolute -top-1 -translate-x-1/2 text-[10px]"
        style={{ left: `${pos * 100}%` }}
      >
        {t("quincenaToday")}
      </span>
    </div>
  );
}
```

`left:50%` and `left:0%` must be the literal style output, so keep `${pos * 100}%` with no rounding. The today caption sits above the tick and its `-top-1` clears the note's inner frame; the 360px capture checks it (Task 8).

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run components/overview/quincena-edge.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/overview/quincena-edge.tsx components/overview/quincena-edge.test.tsx messages
git commit -m "feat(overview): the quincena engraved along the note's edge"
```

---

### Task 3: AvailableHero becomes the peso Note

**Files:**
- Modify: `components/overview/available-hero.tsx`
- Test: `components/overview/available-hero.test.tsx` (create)

**Interfaces:**
- Consumes: `Note` (`tone`, `label`, `serial`), `ProofMark` (`tone="flag"`), `fitFigureClass`, `periodSerial`, `QuincenaEdge`.
- Produces: `AvailableHero({ available, netWorth, currency, period, today })` where `period: Period` and `today: string`. Two props are new, so Task 7 passes them.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { AvailableHero } from "./available-hero";
import type { Available } from "@/lib/overview/available";

const base: Available = {
  periodEnd: "2026-09-30", liquid: 3200, committed: 0, cardsMinimum: 0, cardsFull: 0,
  loans: 0, subscriptions: 0, available: 1840, availableIfCardsCleared: 1840, cardBasis: [], fxUnconverted: [],
};
const html = (available: Partial<Available>) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AvailableHero
        available={{ ...base, ...available }}
        netWorth={18430}
        currency="DOP"
        period={{ start: "2026-09-16", end: "2026-09-30" }}
        today="2026-09-23"
      />
    </NextIntlClientProvider>,
  );

describe("AvailableHero", () => {
  it("prints the period serial on the note", () => {
    expect(html({})).toContain("QNA 2026-09 B");
  });
  it("keeps net worth on the note", () => {
    expect(html({})).toContain("Net worth");
  });
  it("prints a negative figure on a white inset with a flag mark, not on the orange", () => {
    const out = html({ available: -250 });
    expect(out).toContain("Committed beyond your balance");
    expect(out).toContain("text-(--red)");
    expect(out).toContain("bg-(--paper-2)");
  });
  it("shows no flag when the figure is positive", () => {
    expect(html({})).not.toContain("Committed beyond your balance");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/overview/available-hero.test.tsx`
Expected: FAIL (props do not exist, no serial).

- [ ] **Step 3: Implement**

Replace `HeroCard` with `Note` in `available-hero.tsx`. Keep `Row`, the `useEffect` mobile collapse, `toggleBreakdown` and every ARIA attribute unchanged. Make these changes:

```tsx
import { Note } from "@/components/papel/note";
import { ProofMark } from "@/components/papel/proof-mark";
import { QuincenaEdge } from "@/components/overview/quincena-edge";
import { periodSerial } from "@/lib/overview/period-serial";
import { fitFigureClass } from "@/lib/papel/fit";
import { formatMoney } from "@/lib/format";
import type { Period } from "@/lib/period/cycle";
import { cn } from "@/lib/utils";
```

Add `period: Period; today: string;` to the props and destructure them. Then:

```tsx
const figureClass = cn(
  fitFigureClass(formatMoney(a.available, currency)),
  "[font-stretch:125%] font-extrabold",
);

return (
  <Note tone="peso" label={t("availableLabel", { date })} serial={periodSerial(period.start)}>
    {negative ? (
      <div className="inline-block max-w-full rounded-[3px] bg-(--paper-2) px-3 py-2 text-(--red)">
        <MoneyDisplay amount={a.available} currency={currency} size="hero" animate className={figureClass} />
        <ProofMark tone="flag" className="mt-1 block">{t("availableOver")}</ProofMark>
      </div>
    ) : (
      <MoneyDisplay amount={a.available} currency={currency} size="hero" animate className={figureClass} />
    )}
    {/* the "if you clear your cards" line, toggle, breakdown, and net worth row stay as they were */}
    <QuincenaEdge start={period.start} end={period.end} today={today} />
  </Note>
);
```

Other edits inside the component:
- Remove `className={negative ? "text-destructive" : undefined}` from the old `MoneyDisplay`.
- `decoration-white/40` becomes `decoration-current/40` and `border-white/15` becomes `border-current/20`, since the ink is now the peso ink, not white.
- Delete the now-unused `HeroCard` import.
- Put `<QuincenaEdge>` after the net-worth row, so net worth stays visible at every width and the edge is the bottom of the note. The breakdown disclosure stays a sibling of net worth, as the existing comment requires.

`cn` (twMerge) lets `figureClass` override MoneyDisplay's `text-5xl sm:text-6xl`. If it does not, drop the default size from `SIZES.hero` in a follow-up, but do not change other callers.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/overview/available-hero.test.tsx && npx tsc --noEmit`
Expected: PASS. `tsc` fails in `app/(app)/page.tsx` until Task 7 passes `period` and `today`. Accept that one error here.

- [ ] **Step 5: Commit**

```bash
git add components/overview/available-hero.tsx components/overview/available-hero.test.tsx
git commit -m "feat(overview): Disponible is a peso note with a quincena edge"
```

---

### Task 4: PeriodStub ("Este período")

**Files:**
- Create: `components/overview/period-stub.tsx`, `components/overview/period-stub.test.tsx`

**Interfaces:**
- Consumes: `LedgerRow`, `RuleMeter`, `ProofMark`, `MoneyDisplay`, `formatPercent`.
- Produces: `<PeriodStub income spending used budget currency />`, all `number` except `currency: string`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { PeriodStub } from "./period-stub";

const html = (used: number, budget: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PeriodStub income={3120} spending={2040} used={used} budget={budget} currency="DOP" />
    </NextIntlClientProvider>,
  );

describe("PeriodStub", () => {
  it("prints three ruled figures and a rule meter, not cards", () => {
    const out = html(500, 1000);
    expect(out).toContain("Income this period");
    expect(out).toContain("Paid out this period");
    expect(out).toContain("Budget used");
    expect(out).toContain('role="meter"');
    expect(out).not.toContain('data-slot="card-header"');
  });
  it("flags an overspent budget with a glyph, not only colour", () => {
    expect(html(1200, 1000)).toContain("text-(--red)");
  });
  it("shows a dash and no flag when there is no budget", () => {
    const out = html(0, 0);
    expect(out).toContain("—");
    expect(out).not.toContain("text-(--red)");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/overview/period-stub.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { ArrowDownLeft, ArrowUpRight, PieChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { ProofMark } from "@/components/papel/proof-mark";
import { formatPercent } from "@/lib/format";

const glyph = "size-4 shrink-0 text-muted-foreground";

/** The stub torn from the Disponible note: the period's three figures as one
 *  ruled table. The dashed rule on top is the perforation; it is plain CSS on
 *  purpose (a new primitive would need a DESIGN.md change). */
export function PeriodStub({
  income, spending, used, budget, currency,
}: { income: number; spending: number; used: number; budget: number; currency: string }) {
  const t = useTranslations("Overview");
  const over = budget > 0 && used > budget;
  const pct = budget > 0 ? Math.min(Math.max((used / budget) * 100, 0), 100) : 0;

  return (
    <div>
      <div aria-hidden className="mx-2 border-t-2 border-dashed border-(--ink-soft)" />
      <Card className="gap-0 rounded-t-none border-t-0 p-0">
        <LedgerRow
          lead={<ArrowDownLeft aria-hidden className={glyph} />}
          title={t("incomeThisPeriod")}
          amount={<MoneyDisplay amount={income} currency={currency} size="inline" animate className="text-foreground" />}
        />
        <LedgerRow
          lead={<ArrowUpRight aria-hidden className={glyph} />}
          title={t("spendingThisPeriod")}
          amount={<MoneyDisplay amount={spending} currency={currency} size="inline" animate className="text-foreground" />}
        />
        <LedgerRow
          lead={<PieChart aria-hidden className={glyph} />}
          title={t("budgetUsed")}
          subtitle={
            <span className="block pt-1.5">
              <RuleMeter used={used} total={budget} label={t("budgetUsed")} />
              {over ? <ProofMark tone="flag" className="mt-1.5">{formatPercent(pct)}</ProofMark> : null}
            </span>
          }
          wrapSubtitle
          amount={
            <>
              <MoneyDisplay amount={used} currency={currency} size="inline" animate className="text-foreground" />
              <p className="figure text-xs text-muted-foreground">{budget > 0 ? formatPercent(pct) : "—"}</p>
            </>
          }
        />
      </Card>
    </div>
  );
}
```

Notes for the implementer: `ProofMark tone="flag"` carries `text-(--red)`, which the over-budget test asserts. `formatPercent(pct)` is clamped at 100, exactly as the old card did. `LedgerRow`'s `subtitle` is a `<p>`, so the `<span>` wrapper avoids nesting a block element in it. `RuleMeter` renders a `<div>`, so confirm it does not produce a hydration warning; if it does, change the row to `title={<>…</>}` and pass the meter in as a following sibling row.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/overview/period-stub.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/overview/period-stub.tsx components/overview/period-stub.test.tsx
git commit -m "feat(overview): Este período as a ruled stub"
```

---

### Task 5: Margin note and baseline Ask

**Files:**
- Modify: `components/overview/recommendation-card.tsx`, `components/overview/ask-entry.tsx`

**Interfaces:** props unchanged for both (`RecommendationCard({ rec, stale })`, `AskEntry()`).

- [ ] **Step 1: RecommendationCard**

Keep every line of the stale-while-revalidate logic. Replace only the three returns and the imports. Delete the `Card`, `ColorTile`, `Sparkles` and `toneColor` imports.

```tsx
if (rec) {
  return (
    <aside className="border-l-2 border-(--ink) pl-4">
      <p className="legend text-[10px] text-muted-foreground">{t("recommendationTitle")}</p>
      <p className="mt-1 font-medium text-foreground">{rec.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{rec.body}</p>
    </aside>
  );
}

if (pending) {
  return (
    <aside className="border-l-2 border-(--paper-line) pl-4" aria-busy aria-label={t("recommendationLoading")}>
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton mt-2 h-4 w-40 rounded" />
      <div className="skeleton mt-2 h-3 w-full rounded" />
      <div className="skeleton mt-1.5 h-3 w-2/3 rounded" />
    </aside>
  );
}
```

The tone no longer picks a colour: state is by rule weight and the sentence itself, so `rec.tone` is unused in the UI. Leave it in the type, and leave `lib/overview/recommendation/tone.ts` alone (Phase 7 removes dead code).

- [ ] **Step 2: AskEntry**

Delete the `Card`, `Button`, `ColorTile` and `MessagesSquare` imports. Keep `ArrowRight`, `MAX_INITIAL_QUESTION` and the submit logic. Replace the `return`:

```tsx
return (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      const q = question.trim();
      router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask");
    }}
    className="flex items-center gap-3 border-b-2 border-(--rule) pb-2 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-current"
  >
    <label className="sr-only" htmlFor="overview-ask">{t("askLabel")}</label>
    <input
      id="overview-ask"
      name="q"
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      placeholder={t("askPlaceholder")}
      maxLength={MAX_INITIAL_QUESTION}
      autoComplete="off"
      className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
    />
    <button type="submit" aria-label={t("askSubmit")} className="grid size-9 shrink-0 place-items-center text-foreground">
      <ArrowRight className="size-5" />
    </button>
  </form>
);
```

`text-base` (16px) on the input also stops iOS zooming on focus. Keep the long doc comment above the component, trimmed of the ColorTile paragraph.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "recommendation-card|ask-entry" ; npx eslint components/overview/recommendation-card.tsx components/overview/ask-entry.tsx`
Expected: no output from either (no unused imports, no type errors in these files).

- [ ] **Step 4: Commit**

```bash
git add components/overview/recommendation-card.tsx components/overview/ask-entry.tsx
git commit -m "feat(overview): coach tip as a margin note, Ask as a baseline rule"
```

---

### Task 6: Import callout and the empty state note

**Files:**
- Modify: `components/overview/import-callout.tsx`

**Interfaces:**
- Produces: `ImportCallout({ state })` (unchanged signature) and new `EmptyOverviewNote({ currency }: { currency: string })`, the violet note for a user with no accounts.

- [ ] **Step 1: Restyle `ImportCallout`**

Remove the `Card` and `SpotIllustration` imports and use a left-ruled block, as the coach tip does:

```tsx
<div className="border-l-2 border-(--ink) pl-4">
  <p className="text-base font-medium text-foreground">{t(titleKey)}</p>
  <p className="mt-1 max-w-md text-sm text-muted-foreground">{t(bodyKey)}</p>
  <Button className="mt-3" onClick={() => setOpen(true)}>{t("importCalloutCta")}</Button>
</div>
```

Keep the `StatementImportDialog` mount as it is.

- [ ] **Step 2: Add `EmptyOverviewNote` to the same file**

It shares the dialog state, so it lives in the same client file. Add the imports `Link from "next/link"`, `Note`, `MoneyDisplay`, `ArrowUpRight`.

```tsx
/** The empty Overview's one Note. Statement import comes first (PRODUCT.md
 *  principle 2); adding an account by hand is the quiet second action. */
export function EmptyOverviewNote({ currency }: { currency: string }) {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Note
        tone="violet"
        label={t("netWorth")}
        action={
          <>
            <Button className="border-(--note-ink) bg-(--note-ink) text-(--note) hover:bg-(--note-ink)/90" onClick={() => setOpen(true)}>
              {t("importCalloutCta")}
            </Button>
            <Button
              variant="outline"
              className="border-(--note-ink) bg-transparent text-(--note-ink) hover:bg-transparent"
              nativeButton={false}
              render={<Link href="/accounts" />}
            >
              {t("addAccount")}
              <ArrowUpRight className="size-4" />
            </Button>
          </>
        }
      >
        <MoneyDisplay amount={0} currency={currency} size="hero" className="[font-stretch:125%] font-extrabold" />
        <p className="mt-3 max-w-md text-sm opacity-85">{t("netWorthEmptyBody")}</p>
      </Note>
      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}
```

Check the two `Button`s at 4.5:1 in the Task 8 capture. The inverse slab and the outline are the only two variants that clear a violet field.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit 2>&1 | grep import-callout; npx eslint components/overview/import-callout.tsx`
Expected: no output.

```bash
git add components/overview/import-callout.tsx
git commit -m "feat(overview): import is the first action on the empty note"
```

---

### Task 7: Compose the page and the loading sheet

**Files:**
- Modify: `app/(app)/page.tsx`, `app/(app)/loading.tsx`
- Test: `npx tsc --noEmit`, `npm run lint`

**Interfaces:** consumes `AvailableHero({..., period, today})`, `PeriodStub`, `EmptyOverviewNote`, `LedgerRow`, `localDate` from `@/lib/period/cycle`.

- [ ] **Step 1: Empty state**

Replace the `HeroCard` block, the `ImportCallout` block and the starter `Card` grid. Remove the `STARTER_CARDS` `tint` field and the `Card`, `ColorTile`, `HeroCard`, `SpotIllustration`, `Button`, `ArrowUpRight` imports the page no longer uses.

```tsx
<div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
  <EmptyOverviewNote currency={o.baseCurrency} />
</div>
<Card className="rise gap-0 p-0" style={{ "--i": 2 } as React.CSSProperties}>
  {STARTER_CARDS.map(({ href, icon: Icon, key }) => (
    <Link key={href} href={href} className="block outline-offset-[-2px] hover:bg-accent/40">
      <LedgerRow
        lead={<Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
        title={t(`starter${key}Title`)}
        subtitle={t(`starter${key}Body`)}
        wrapSubtitle
      />
    </Link>
  ))}
</Card>
```

Keep `Card` imported for this list. The `ImportCallout` is dropped from the empty state, because the note now carries the import action. `importPromptState` returns `"never"` for an empty card list, so nothing is lost.

- [ ] **Step 2: Populated state**

Keep `PageHeader` and its `ImportButton` (desktop only). Replace everything from the hero to the end of Upcoming:

```tsx
<div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
  <AvailableHero available={o.available} netWorth={o.netWorth} currency={o.baseCurrency} period={o.period} today={localDate()} />
</div>

{/* Directly under the note it qualifies. */}
<FxDegradedNotice currencies={o.fxUnconverted} base={o.baseCurrency} className="rise" />

<div className="rise space-y-2" style={{ "--i": 2 } as React.CSSProperties}>
  <div className="flex items-center justify-between gap-3">
    <h2 className="legend text-[11px] text-muted-foreground">{t("thisPeriod")}</h2>
    <ImportButton variant="outline" size="sm" className="sm:hidden" />
  </div>
  <PeriodStub income={o.monthIncome} spending={o.monthExpense} used={o.totalUsed} budget={o.totalBudget} currency={o.baseCurrency} />
</div>

{o.importPrompt !== "none" ? (
  <div className="rise" style={{ "--i": 3 } as React.CSSProperties}><ImportCallout state={o.importPrompt} /></div>
) : null}

<div className="rise" style={{ "--i": 4 } as React.CSSProperties}><RecommendationCard rec={rec} stale={stale} /></div>
<div className="rise" style={{ "--i": 5 } as React.CSSProperties}><AskEntry /></div>

<div className="rise space-y-2" style={{ "--i": 6 } as React.CSSProperties}>
  <h2 className="legend text-[11px] text-muted-foreground">{t("upcoming")}</h2>
  {o.upcoming.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t("upcomingEmpty")}</p>
  ) : (
    <Card className="gap-0 p-0">
      {o.upcoming.map((item) => (
        <LedgerRow
          key={item.key}
          lead={<CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
          title={item.title}
          subtitle={item.subtitle}
          amount={<MoneyDisplay amount={item.amount} currency={item.currency} size="inline" className="text-foreground" />}
          meta={upcomingFmt.format(new Date(item.date))}
        />
      ))}
    </Card>
  )}
</div>
```

Placement decisions, deliberately: the FX notice sits between the note and the stub whenever rates are degraded, which breaks the stub's continuity only in that rare state. The import callout (only for "never" or "overdue") comes after the stub so it never interrupts the note-and-stub document. Delete the `budgetPct` const, since the stub computes its own. The mobile heading row keeps the import button's phone home, as the old comment describes; the header's copy of the button stays `max-sm:hidden`.

- [ ] **Step 3: Loading sheet**

In `app/(app)/loading.tsx`, replace the hero and the three-card grid with unprinted ruled paper: a `skeleton h-52 rounded-[6px]` for the note, then a `Card`-less block of three `skeleton h-12` rows separated by `border-b border-(--paper-line)`. No shimmer beyond the existing `.skeleton` class.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/page.tsx" "app/(app)/loading.tsx"
git commit -m "feat(overview): the cheque-stub composition"
```

---

### Task 8: Help guide, batched review, close-out

**Files:**
- Modify: `components/help/mocks.tsx` (`OverviewMock`), `messages/{en,es}.json` (Help overview copy), `app/(app)/help/page.tsx` only if props change; `DESIGN.md` via the documenter.

- [ ] **Step 1: Help copy audit**

Run: `rg -n -i "card|hero|headline|rail|tile" messages/en.json | rg -i "overview|disponible|upcoming"`
Rewrite every Overview help string that describes the old look ("inside the same card", "a rail of what's due next", "starter cards") so it matches the new UI ("on the same peso note", "a ledger of what's due next", "starter links"). Do en and es in the same edit.

- [ ] **Step 2: Rebuild `OverviewMock`**

Wrap it in `SpecimenFrame`. Compose it from the real primitives: a peso `Note` with `MoneyDisplay` and the breakdown rows, then the same dashed rule and a `Card`/`LedgerRow` stub for income, spent and budget used (`RuleMeter` at 64%), then an upcoming `LedgerRow`. Keep its prop names, so `help/page.tsx` needs no change. Add a static `QuincenaEdge start="2026-09-16" end="2026-09-30" today="2026-09-23"`.

- [ ] **Step 3: i18n parity**

Run:
```bash
node -e 'const f=(o,p="")=>Object.entries(o).flatMap(([k,v])=>typeof v==="object"?f(v,p+k+"."):[p+k]);const en=new Set(f(require("./messages/en.json"))),es=new Set(f(require("./messages/es.json")));const d=[...en].filter(k=>!es.has(k)).concat([...es].filter(k=>!en.has(k)));console.log(d.length?d:"parity ok");process.exit(d.length?1:0)'
```
Expected: `parity ok`.

- [ ] **Step 4: Batched visual review (ask the user first)**

Ask before starting the dev server. With consent: `ss -ltnp | grep 3000`, then `NODE_OPTIONS=--max-old-space-size=6144 npx next dev -p 3000` with `run_in_background`. Using `agent-browser` in the session from `agent-browser session id --scope worktree --prefix tywin`, capture `/` and `/help#overview` at 1440×900 and 360×780, light and dark, locale es, into `.impeccable/review/phase1-<route>-<w>-<theme>.png`. Populated and empty states both. Check:
- An eight-digit figure plus `RD$` fits 360px without wrapping (tune `fitFigureClass` if not).
- The Today caption and ticks do not collide with the note frame or the serial.
- Negative Disponible: figure on the white inset, flag mark present.
- The breakdown disclosure collapses on mobile; net worth stays visible.
- No horizontal scroll at 360px; nothing behind the bottom band or FAB.
- Exactly one Note on the page.
- Figure-mask on: widths hold.
Fix everything in one batch, recapture once, then stop the server, run `agent-browser close`, and confirm with `pgrep -af "next dev"`.

- [ ] **Step 5: Detector, finish reviewer, documenter**

Run: `node .claude/skills/impeccable/scripts/detect.mjs --json components/overview app/(app)/page.tsx`. Fix what is mechanical. Spawn `impeccable-finish-reviewer` fresh with the spec path, this plan, the screenshot paths, the detector output, `reference/craft-floor.md` and the locked cheque-stub choice. Act on its disposition per `reference/new-work.md` §7, at most two rounds. Then spawn `impeccable-documenter` to extend `DESIGN.md` with the Overview composition. Then run `/impeccable audit "app/(app)/page.tsx"` and `/impeccable polish "app/(app)/page.tsx"`.

- [ ] **Step 6: Full verification, commit, merge, delete the branch**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all pass, and the build succeeds.

```bash
git add -A components app lib messages DESIGN.md docs
git commit -m "feat(overview): Papel Overview, cheque stub, help guide updated"
git checkout main && git merge --no-ff redesign/papel-overview
git branch -d redesign/papel-overview && git push origin --delete redesign/papel-overview 2>/dev/null; git push origin main
git --no-pager log --oneline -3
```
Expected: the merge commit is at the top of `main`. (Attribution lines on both commits.) Leave `.impeccable/review/` out of `git add`.

---

## Self-review

- **Spec and Task 12 coverage:** peso Note with expanded numerals and quincena edge (Tasks 1–3); serial `QNA yyyy-mm A|B`, `aria-hidden` via `Serial` (Task 3); net worth and breakdown ARIA kept (Task 3); negative on a white inset with flag ProofMark (Task 3); ruled "Este período" with `RuleMeter` (Task 4); margin note, baseline Ask, Upcoming `LedgerRow` with date as `meta` (Tasks 5 and 7); empty state with the violet import Note and `LedgerRow` starter links (Tasks 6–7); FX notice directly under the note (Task 7); figure-mask widths (checked in Task 8); help guide (Task 8); at most one Note (empty and populated are separate branches, each with one).
- **Placeholders:** none. Two deliberate deferrals are tuned by capture: the `fitFigureClass` thresholds and the empty-note button contrast.
- **Type consistency:** `AvailableHero({ available, netWorth, currency, period, today })` matches Task 7's call. `PeriodStub` props match Task 7. `periodProgress` returns `{ day, total, pos }`, as Task 2 uses it.
- **Known trade-off:** the FX-degraded notice interrupts the note-and-stub pair when it shows.
