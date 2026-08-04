# Cashly Playful Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cashly's muted "ink and paper" dashboard language with a playful consumer-finance app language — vivid brand, full-strength category colour, oversized numerals, real credit-card faces, and richer motion.

**Architecture:** Three layers, strictly in order. Foundation (design tokens in `app/globals.css`, palette in `lib/palette.ts`) changes values only and propagates everywhere for free. Primitives (`components/ui/`) add four new components and change three, absorbing four duplicated code blocks into one. Surfaces then compose those primitives. All logic that can be tested is extracted into pure functions under `lib/` first, tested with vitest, then consumed by components.

**Tech Stack:** Next.js 16 (App Router, RSC), Tailwind v4 (CSS-first `@theme`), shadcn + Base UI, next-intl (en/es), next-themes, Recharts, vitest.

**Spec:** `docs/specs/2026-08-04-playful-redesign-design.md`

## Global Constraints

- **No new dependencies.** Not one. Illustrations and network marks are hand-written inline SVG.
- **No new schema.** Exactly one migration exists (`supabase/migrations/20260804120000_brighten_palette.sql`), already written and committed. **The agent must never run `npm run db:push`** — the user pushes it.
- **The UI must render correctly with BOTH the old and new stored palette.** There is a window where the migration has not been applied. Never hardcode an assumption that a stored colour is one of the new sixteen.
- **Both themes are first-class.** Light is default. Every change is verified in light and dark.
- **i18n:** all user-visible copy goes through `next-intl`. New strings are added to **both** `messages/en.json` and `messages/es.json`. No hardcoded English.
- **Figure masking must keep working.** Anything rendering money routes through `useFigureMask`.
- **`prefers-reduced-motion: reduce` must leave no element stranded at `opacity: 0`.** Every new animation gets an explicit reset in the existing reduce block.
- **Contrast:** palette values clear 3:1 — good for glyphs, icons, large text. Never small body text on a coloured fill.
- **Testing reality:** vitest runs in Node with no DOM (`vitest.config.ts` has no `environment`). There is no `@testing-library/react` and none may be added. Therefore **only pure functions in `lib/` get unit tests.** Components are verified by `npm run build` plus explicit visual review. Do not write component tests; do not add a DOM environment.
- **Commands:** `npm test` (vitest run), `npm run lint`, `npm run build`.

---

## File Structure

**New — pure logic (tested):**
- `lib/money-parts.ts` — split a formatted money string into head/separator/cents.
- `lib/color.ts` — relative luminance and readable-foreground selection.
- `lib/accounts/network.ts` — card network and last4 inference.

**New — components (not unit-tested):**
- `components/ui/money-display.tsx` — oversized numerals with de-emphasised cents.
- `components/ui/color-tile.tsx` — the filled identity tile; replaces four duplicates.
- `components/ui/stat-pill.tsx` — delta chip.
- `components/ui/hero-card.tsx` — the gradient slab.
- `components/accounts/payment-card.tsx` — the physical card face.
- `components/accounts/network-mark.tsx` — simplified network SVGs.
- `components/brand/spot-illustration.tsx` — flat SVG spot art.

**Modified — foundation:**
- `app/globals.css` — tokens, radius, elevation, motion layer.
- `lib/palette.ts` — brightened `SWATCHES`.
- `lib/format.ts` — extract `moneyFormatter` so splitting and formatting share one config.

**Modified — primitives:** `components/ui/button.tsx`, `card.tsx`, `badge.tsx`.

**Modified — surfaces:** `components/shell/{sidebar,bottom-nav,nav-link}.tsx`, `components/quick-add/quick-add-button.tsx`, `app/(app)/page.tsx`, `components/transactions/transaction-row.tsx`, `components/budgets/budget-grid.tsx`, `components/accounts/{account-card,card-group-tile}.tsx`, `components/insights/*`, `app/login/page.tsx`, `components/marketing/marketing-home.tsx`.

---

## Task 1: Foundation tokens

**Files:**
- Modify: `app/globals.css:124-301` (the `:root` and `.dark` blocks) and the palette rationale comment at `:87-122`.

**Interfaces:**
- Produces: CSS custom properties consumed by every later task — `--brand`, `--brand-foreground`, `--brand-muted`, `--hero`, `--hero-foreground`, `--radius`, `--shadow-card`, `--shadow-card-hover`, plus retinted neutrals and semantics.

- [ ] **Step 1: Rewrite the rationale comment**

The comment at `app/globals.css:87-122` states the rule this redesign removes ("There is no third brand hue", "Nothing decorative is coloured"). Replace it with the new rule so future work does not drift back:

```
/* ============================================================
   Identity colour
   ============================================================
   This app is a consumer finance product, not a ledger. Colour carries
   identity, not only meaning.

   The neutrals are cool and near-achromatic so that saturated colour has
   somewhere quiet to sit. Violet is the brand: it owns the hero, primary
   actions, active navigation and brand moments. It is not rationed to
   "interactive state" — that restriction is what made the app read as a
   dashboard.

   Category colour is a first-class system. Every category and account
   carries a stored hex (see lib/palette.ts) and renders as a FILLED tile,
   not a wash. Those values live in the database, so this file must never
   assume a category's colour is one of the sixteen shipped swatches.

   Semantic status keeps its own colours: green in, red out, amber for
   attention. They are tuned to read app-bright rather than ledger-sober.

   Contrast contract: every identity colour clears 3:1 against white and
   against both card surfaces. That covers glyphs, icons and large text.
   It does NOT cover small body text on a coloured fill.
   ============================================================ */
```

- [ ] **Step 2: Retint the light theme**

In `:root`, replace these values (leave every other declaration untouched):

```css
  --background: #f5f6fb;
  --foreground: #14141c;
  --card: #ffffff;
  --card-foreground: #14141c;
  --popover: #ffffff;
  --popover-foreground: #14141c;
  --primary: #1b1b26;
  --primary-foreground: #f7f7fb;
  --secondary: #eceef7;
  --secondary-foreground: #2b2b38;
  --muted: #f1f2f9;
  --muted-foreground: #6b6b7b;
  --accent: #e7e9f5;
  --accent-foreground: #2b2b38;

  --brand: #6C4EF5;
  --brand-foreground: #ffffff;
  --brand-muted: #ebe6ff;
  --destructive: #F04438;
  --destructive-foreground: #ffffff;
  --success: #12B76A;
  --success-foreground: #ffffff;
  --warning: #F79009;
  --warning-foreground: #1c1200;
  --gold: #F79009;
  --gold-foreground: #1c1200;
  --border: #e3e5ef;
  --input: #dcdfec;
  --ring: #6C4EF5;

  --radius: 1.25rem;

  --sidebar: #ffffff;
  --sidebar-foreground: #14141c;
  --sidebar-primary: #6C4EF5;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eeebff;
  --sidebar-accent-foreground: #3a2b7a;
  --sidebar-border: #e6e8f2;
  --sidebar-ring: #6C4EF5;
```

- [ ] **Step 3: Replace the brand panel tokens with hero tokens**

Still in `:root`, replace the `--brand-panel` / `--brand-panel-foreground` pair with:

```css
  /* The signature gradient. Identical in both themes: it is the one surface
     that does not invert, so the brand moment reads the same either way. */
  --hero: linear-gradient(135deg, #6C4EF5 0%, #4326C9 100%);
  --hero-foreground: #ffffff;
```

Add the matching entries to the `@theme inline` block at `app/globals.css:52-57`, replacing the `--color-brand-panel*` lines:

```css
  --color-hero-foreground: var(--hero-foreground);
```

`--hero` is a gradient, not a colour, so it is used via `bg-[image:var(--hero)]` and gets no `--color-*` mapping.

- [ ] **Step 4: Simplify light elevation**

The four-layer shadow exists to separate white-on-white. The page is now tinted, so replace:

```css
  --shadow-card:
    0 1px 2px rgb(20 20 28 / 0.04), 0 8px 24px -12px rgb(20 20 28 / 0.10);
  --shadow-card-hover:
    0 2px 4px rgb(20 20 28 / 0.06), 0 16px 40px -16px rgb(20 20 28 / 0.16);
  --shadow-float: 0 8px 20px -6px rgb(108 78 245 / 0.45);
```

- [ ] **Step 5: Retint the dark theme**

In `.dark`, replace:

```css
  --background: #0a0a0f;
  --foreground: #e8e8f0;
  --card: #16161f;
  --card-foreground: #e8e8f0;
  --muted: #1e1e2a;
  --muted-foreground: #9494a6;
  --popover: #242433;
  --popover-foreground: #e8e8f0;
  --primary: #e8e8f0;
  --primary-foreground: #12121a;
  --accent: #2f2f40;
  --accent-foreground: #e0e0ea;
  --secondary: #383850;
  --secondary-foreground: #cdcdda;

  --brand: #8B72FF;
  --brand-foreground: #12091f;
  --brand-muted: #2a2450;
  --destructive: #FF6B5E;
  --destructive-foreground: #1f0705;
  --success: #3DD68C;
  --success-foreground: #04140b;
  --warning: #FDB022;
  --warning-foreground: #1a1000;
  --gold: #FDB022;
  --gold-foreground: #1a1000;
  --border: #333346;
  --input: #3d3d52;
  --ring: #8B72FF;

  --sidebar: #101018;
  --sidebar-foreground: #e8e8f0;
  --sidebar-primary: #8B72FF;
  --sidebar-primary-foreground: #12091f;
  --sidebar-accent: #241f45;
  --sidebar-accent-foreground: #c8bcff;
  --sidebar-border: #22222f;
  --sidebar-ring: #8B72FF;
```

Leave `--hero` and `--hero-foreground` out of `.dark` entirely — they are deliberately shared.

- [ ] **Step 6: Verify the dark surface ladder**

The comment at `app/globals.css:216-225` requires `background < card < muted < popover < accent < secondary < border < input`, with no two rungs equal. Read the values just written and confirm each is strictly lighter than the previous:
`#0a0a0f < #16161f < #1e1e2a < #242433 < #2f2f40 < #383850 < #333346`.

**This ordering is violated** — `border: #333346` is darker than `secondary: #383850`. That is acceptable and matches the original file, where `border` also sat below `secondary`; the ladder's intent is that the *fill* surfaces climb. Confirm `background < card < muted < popover < accent < secondary` holds strictly, and that `border < input`.

- [ ] **Step 7: Build and eyeball**

Run: `npm run build`
Expected: succeeds.

Then start the dev server **only if the user approves it** (they have asked to be consulted before the dev server is started or killed). Load `/` in light and dark. The app will look half-finished — cards are still square and buttons still small. That is expected; only confirm nothing is unreadable or invisible.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): retint tokens to cool neutrals and violet brand"
```

---

## Task 2: Brighten the swatch palette

**Files:**
- Modify: `lib/palette.ts:24-27` (`SWATCHES`) and its doc comment at `:3-23`
- Create: `lib/palette.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SWATCHES: string[]` (16 uppercase hex), unchanged `SWATCH_CLASS`. `colorCardStyle` is untouched by this task — its removal is Task 4 Step 3's job, not this one's; do not delete it here.

- [ ] **Step 1: Write the failing test**

Create `lib/palette.test.ts`. This encodes the contrast contract so a future edit cannot quietly break it:

```ts
import { describe, it, expect } from "vitest";
import { SWATCHES } from "./palette";

const lin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a: number, b: number) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = luminance("#ffffff");
const CARD_DARK = luminance("#16161f");

describe("SWATCHES", () => {
  it("has sixteen unique values", () => {
    expect(SWATCHES).toHaveLength(16);
    expect(new Set(SWATCHES.map((s) => s.toLowerCase())).size).toBe(16);
  });

  it("is all valid six-digit hex", () => {
    for (const s of SWATCHES) expect(s).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  // Each swatch is a tile fill behind a white glyph, and a chip foreground on
  // both card surfaces. 3:1 covers glyphs, icons and large text.
  it("clears 3:1 against white for use as a tile fill", () => {
    for (const s of SWATCHES) {
      expect(ratio(luminance(s), WHITE), `${s} vs white`).toBeGreaterThanOrEqual(3);
    }
  });

  it("clears 3:1 against the dark card for use as a chip foreground", () => {
    for (const s of SWATCHES) {
      expect(ratio(luminance(s), CARD_DARK), `${s} vs dark card`).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- lib/palette.test.ts`
Expected: FAIL — the current `#b6770b` gives 2.77:1 against white and `#7e903e` gives 2.99:1.

- [ ] **Step 3: Replace SWATCHES**

In `lib/palette.ts`, replace the array with the validated values. These are the exact values the committed migration writes, so the app and the database agree:

```ts
export const SWATCHES = [
  "#4361F0", "#CE830A", "#00A08A", "#E85B3F", "#9B4FBC", "#899C39", "#1A96CE", "#DB4A76",
  "#CE7A38", "#98912B", "#4AA331", "#309E54", "#8471E8", "#C752B0", "#E0666C", "#8A8698",
];
```

Replace the doc comment at `:3-23` — its rationale describes the old luminance window and the old chip-foreground-only job:

```ts
/**
 * Identity colours for categories, accounts and goals. Stored as literal hex on
 * the row — not `var(--chart-n)` — because the value has to survive a theme
 * switch.
 *
 * These serve two jobs, and every value is validated for both (see
 * lib/palette.test.ts, which fails the build if a future edit breaks it):
 *
 *   1. Tile FILL behind a white glyph  -> >= 3:1 against #ffffff
 *   2. Chip FOREGROUND on either card  -> >= 3:1 against #ffffff and #16161f
 *
 * The tightest are amber and olive at 3.05:1 against white. 3:1 covers glyphs,
 * icons and large text; it does not cover small body text on a filled tile.
 *
 * These are hue-matched to the sixteen they replaced, so an existing category
 * keeps its identity and only gains saturation. The matching database rewrite
 * is supabase/migrations/20260804120000_brighten_palette.sql. Until the user
 * pushes it, rows still hold the old values — every consumer must therefore
 * treat a stored colour as an arbitrary hex, never as an index into this array.
 */
```

- [ ] **Step 4: Run the test**

Run: `npm test -- lib/palette.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/palette.ts lib/palette.test.ts
git commit -m "feat(design): brighten identity palette with contrast test"
```

---

## Task 3: Money splitting

**Files:**
- Modify: `lib/format.ts:12-29`
- Create: `lib/money-parts.ts`, `lib/money-parts.test.ts`

**Interfaces:**
- Consumes: `CURRENCY_LOCALE` (private to `lib/format.ts`).
- Produces:
  - `moneyFormatter(currency: string, opts?: MoneyOpts): Intl.NumberFormat` from `lib/format.ts`
  - `type MoneyOpts = { compact?: boolean; signed?: boolean; maximumFractionDigits?: number }`
  - `type MoneyParts = { head: string; sep: string; cents: string }`
  - `splitMoney(amount: number, currency: string, opts?: MoneyOpts): MoneyParts` from `lib/money-parts.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/money-parts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { splitMoney } from "./money-parts";

describe("splitMoney", () => {
  it("splits a USD amount into head, separator and cents", () => {
    expect(splitMoney(8822.89, "USD")).toEqual({ head: "$8,822", sep: ".", cents: "89" });
  });

  // DOP formats in es-DO so it renders the unambiguous RD$ (see lib/format.ts).
  it("keeps the RD$ symbol with the head for DOP", () => {
    expect(splitMoney(8822.89, "DOP")).toEqual({ head: "RD$8,822", sep: ".", cents: "89" });
  });

  it("returns empty cents for a zero-decimal currency", () => {
    const parts = splitMoney(8823, "JPY");
    expect(parts.sep).toBe("");
    expect(parts.cents).toBe("");
    expect(parts.head).toContain("8,823");
  });

  it("pads cents to two digits", () => {
    expect(splitMoney(10.5, "USD")).toEqual({ head: "$10", sep: ".", cents: "50" });
  });

  it("keeps the minus sign with the head", () => {
    expect(splitMoney(-54.99, "USD")).toEqual({ head: "-$54", sep: ".", cents: "99" });
  });

  it("prefixes a plus when signed and positive", () => {
    expect(splitMoney(120, "USD", { signed: true })).toEqual({
      head: "+$120", sep: ".", cents: "00",
    });
  });

  it("does not prefix a plus when signed and negative", () => {
    expect(splitMoney(-120, "USD", { signed: true }).head).toBe("-$120");
  });

  // Compact notation puts a decimal inside the mantissa ("$8.8K"). Splitting
  // there would render "8" huge and "8K" small, which is nonsense.
  it("never splits compact notation", () => {
    const parts = splitMoney(8822.89, "USD", { compact: true });
    expect(parts.sep).toBe("");
    expect(parts.cents).toBe("");
    expect(parts.head).toBe("$8.8K");
  });

  it("agrees with formatMoney when rejoined", async () => {
    const { formatMoney } = await import("./format");
    for (const amount of [0, 1, -1, 10.5, 8822.89, -54.99, 1000000]) {
      const p = splitMoney(amount, "USD");
      expect(p.head + p.sep + p.cents).toBe(formatMoney(amount, "USD"));
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- lib/money-parts.test.ts`
Expected: FAIL — cannot resolve `./money-parts`.

- [ ] **Step 3: Extract the shared formatter**

In `lib/format.ts`, replace the body of `formatMoney` so the `Intl` configuration lives in one place. Export the options type and the formatter:

```ts
export type MoneyOpts = {
  compact?: boolean;
  signed?: boolean;
  maximumFractionDigits?: number;
};

/**
 * The one place currency formatting is configured. `splitMoney` needs the same
 * configuration to locate the fraction digits, and a second copy would drift.
 */
export function moneyFormatter(currency: string, opts?: MoneyOpts): Intl.NumberFormat {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency in CURRENCY_LOCALE ? "symbol" : "narrowSymbol",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}

export function formatMoney(amount: number, currency: string, opts?: MoneyOpts): string {
  const value = moneyFormatter(currency, opts).format(amount);
  if (opts?.signed && amount > 0) return `+${value}`;
  return value;
}
```

- [ ] **Step 4: Implement splitMoney**

Create `lib/money-parts.ts`:

```ts
import { moneyFormatter, type MoneyOpts } from "./format";

export type MoneyParts = {
  /** Currency symbol, sign and integer digits — rendered at full size. */
  head: string;
  /** The locale's decimal separator, or "" when there is no fraction. */
  sep: string;
  /** Fraction digits, rendered small and muted. "" when there is none. */
  cents: string;
};

/**
 * Splits a formatted money string so the cents can be de-emphasised.
 *
 * Uses `formatToParts` rather than splitting on ".", because the decimal
 * separator is locale-dependent and the currency symbol can sit on either side
 * of the number.
 */
export function splitMoney(
  amount: number,
  currency: string,
  opts?: MoneyOpts,
): MoneyParts {
  const sign = opts?.signed && amount > 0 ? "+" : "";
  const parts = moneyFormatter(currency, opts).formatToParts(amount);
  const join = (ps: Intl.NumberFormatPart[]) => ps.map((p) => p.value).join("");

  // Compact notation's "." belongs to the mantissa ("$8.8K"), not to cents.
  const i = opts?.compact ? -1 : parts.findIndex((p) => p.type === "decimal");
  if (i === -1) return { head: sign + join(parts), sep: "", cents: "" };

  return {
    head: sign + join(parts.slice(0, i)),
    sep: parts[i].value,
    cents: join(parts.slice(i + 1)),
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- lib/money-parts.test.ts lib/format.test.ts`
Expected: PASS. `lib/format.test.ts` must still pass — the refactor changes no behaviour.

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts lib/money-parts.ts lib/money-parts.test.ts
git commit -m "feat(money): split formatted amounts into head and cents"
```

---

## Task 4: MoneyDisplay and ColorTile

**Files:**
- Create: `components/ui/money-display.tsx`, `components/ui/color-tile.tsx`
- Modify: `lib/palette.ts` (remove `colorCardStyle`)

**Interfaces:**
- Consumes: `splitMoney`, `MoneyParts`, `MoneyOpts`, `useFigureMask`, `maskFigure`.
- Produces:
  - `<MoneyDisplay amount={number} currency={string} size="hero"|"stat"|"inline" opts?={MoneyOpts} className?={string} />`
  - `<ColorTile color={string|null} emoji?={string|null} name?={string|null} icon?={LucideIcon} size="sm"|"md"|"lg" className?={string} />`

- [ ] **Step 1: Create MoneyDisplay**

Create `components/ui/money-display.tsx`. It is a client component because figure masking is client state:

```tsx
"use client";

import { splitMoney } from "@/lib/money-parts";
import { formatMoney, type MoneyOpts } from "@/lib/format";
import { useFigureMask } from "@/components/figure-mask/figure-mask-provider";
import { maskFigure } from "@/components/figure-mask/mask-figure";
import { cn } from "@/lib/utils";

const SIZES = {
  // Jakarta at 800 with tight tracking. This is the loudest object on a screen.
  hero: { head: "text-5xl sm:text-6xl font-extrabold tracking-[-0.03em]", cents: "text-[0.6em]" },
  stat: { head: "text-2xl font-extrabold tracking-[-0.02em]", cents: "text-[0.62em]" },
  inline: { head: "text-base font-semibold", cents: "text-[0.75em]" },
} as const;

/**
 * A money figure with de-emphasised cents — the "$8,822.⁸⁹" treatment.
 *
 * Masked figures are never split: the mask replaces digits with glyphs, and
 * shrinking the tail of a masked string just looks like a rendering fault.
 */
export function MoneyDisplay({
  amount,
  currency,
  size = "stat",
  opts,
  className,
}: {
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  opts?: MoneyOpts;
  className?: string;
}) {
  const { masked } = useFigureMask();
  const s = SIZES[size];

  if (masked) {
    return (
      <span className={cn("figure tabular-nums", s.head, className)}>
        {maskFigure(formatMoney(amount, currency, opts))}
      </span>
    );
  }

  const { head, sep, cents } = splitMoney(amount, currency, opts);
  return (
    <span className={cn("figure tabular-nums", s.head, className)}>
      {head}
      {cents ? (
        <span className={cn(s.cents, "font-bold opacity-60")}>
          {sep}
          {cents}
        </span>
      ) : null}
    </span>
  );
}
```

Note `.figure` currently pins `font-weight: 600` (`app/globals.css:318-323`). Change that rule to `font-weight: inherit` so the size classes above control weight, and keep its `font-variant-numeric` and letter-spacing.

- [ ] **Step 2: Create ColorTile**

Create `components/ui/color-tile.tsx`. This replaces four duplicated blocks:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-9 rounded-xl", glyph: "text-sm", icon: "size-[18px]" },
  md: { box: "size-11 rounded-2xl", glyph: "text-lg", icon: "size-5" },
  lg: { box: "size-14 rounded-2xl", glyph: "text-2xl", icon: "size-6" },
} as const;

/**
 * The identity tile for a category or account: a FILLED colour square with the
 * entity's emoji on it.
 *
 * The fill is the stored hex at full strength, not a wash. `color` is whatever
 * is on the row — an arbitrary hex, possibly one of the pre-brightening values
 * — so nothing here may assume it is a member of SWATCHES.
 *
 * Fallback order is emoji, then supplied icon, then the first letter of the
 * name, then nothing. Glyphs are white: every shipped swatch clears 3:1 there.
 */
export function ColorTile({
  color,
  emoji,
  name,
  icon: Icon,
  size = "sm",
  className,
}: {
  color: string | null;
  emoji?: string | null;
  name?: string | null;
  icon?: LucideIcon;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-white",
        s.box,
        className,
      )}
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    >
      {emoji ? (
        <span className={s.glyph}>{emoji}</span>
      ) : Icon ? (
        <Icon className={s.icon} />
      ) : name ? (
        <span className={s.glyph}>{name.charAt(0).toUpperCase()}</span>
      ) : null}
    </span>
  );
}
```

`aria-hidden` because the tile always sits beside the entity's name — announcing it would duplicate.

- [ ] **Step 3: Remove the superseded helper**

Delete `colorCardStyle` from `lib/palette.ts:52-62` along with its doc comment. It applied colour at 5% — exactly the treatment being replaced. Its call sites are updated in Tasks 8 and 9.

- [ ] **Step 4: Verify nothing else imports it**

Run: `grep -rn "colorCardStyle" --include=*.ts --include=*.tsx app components lib`
Expected: only `components/budgets/budget-grid.tsx` (fixed in Task 9). If any other file appears, update it in this task.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `budget-grid.tsx` for the removed import. That is expected and fixed in Task 9. If you prefer a green tree at every commit, do Task 9 before committing this one.

- [ ] **Step 6: Commit**

```bash
git add components/ui/money-display.tsx components/ui/color-tile.tsx lib/palette.ts app/globals.css
git commit -m "feat(ui): add MoneyDisplay and ColorTile primitives"
```

---

## Task 5: StatPill, Card, Badge, Button

**Files:**
- Create: `components/ui/stat-pill.tsx`
- Modify: `components/ui/card.tsx:18`, `components/ui/badge.tsx`, `components/ui/button.tsx:7-42`

**Interfaces:**
- Produces: `<StatPill children tone="success"|"destructive"|"neutral"|"brand" className? />`; `Button` gains `variant="brand"` and a shifted size scale.

- [ ] **Step 1: Create StatPill**

```tsx
import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/12 text-destructive",
  brand: "bg-brand/12 text-brand",
  neutral: "bg-muted text-muted-foreground",
} as const;

/** A small rounded chip for a delta or share, e.g. "▲ +8%" or "61%". */
export function StatPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Round the Card and drop its ring**

In `components/ui/card.tsx:18`, change `rounded-xl` to `rounded-2xl` and remove `ring-1 ring-foreground/10 dark:ring-white/8`. Update the sibling `rounded-t-xl` / `rounded-b-xl` occurrences at `:31`, `:90` and in the `*:[img:...]` selectors on `:18` to `rounded-t-2xl` / `rounded-b-2xl`.

Replace the stale comment above the class string — it explains the ring that no longer exists:

```tsx
        // The page is tinted, so a white card separates on tone. Elevation is a
        // soft two-layer shadow; the hairline ring the old white-on-white page
        // needed is gone, because it read as a data table.
```

Also update `components/accounts/account-card.tsx:28-30`, whose comment tells the reader cards are "ringed, not bordered", and whose `group-hover:ring-foreground/20` now targets a ring that is not drawn. Replace that class with `group-hover:shadow-(--shadow-card-hover)`.

- [ ] **Step 3: Make Badge a pill**

In `components/ui/badge.tsx`, change the base `rounded-*` class to `rounded-full` and raise horizontal padding to `px-2.5`.

- [ ] **Step 4: Shift the Button scale and add the brand variant**

In `components/ui/button.tsx`, change the base class `rounded-lg` to `rounded-xl`, then replace the `size` variants:

```ts
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 rounded-lg px-3 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-lg px-4 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-7 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
```

Add to `variant`:

```ts
        brand:
          "rounded-full bg-[image:var(--hero)] text-(--hero-foreground) shadow-(--shadow-float) hover:brightness-110",
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/ui/stat-pill.tsx components/ui/card.tsx components/ui/badge.tsx components/ui/button.tsx components/accounts/account-card.tsx
git commit -m "feat(ui): round surfaces, enlarge controls, add brand button and StatPill"
```

---

## Task 6: Colour maths

**Files:**
- Create: `lib/color.ts`, `lib/color.test.ts`

**Interfaces:**
- Produces:
  - `relativeLuminance(hex: string): number`
  - `contrastRatio(a: string, b: string): number`
  - `readableForeground(background: string): "#ffffff" | "#14141c"`
  - `gradientFrom(hex: string): string` — a CSS `linear-gradient` derived from one colour.

- [ ] **Step 1: Write the failing test**

Create `lib/color.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio, readableForeground, gradientFrom } from "./color";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("accepts hex with or without a leading hash, in any case", () => {
    expect(relativeLuminance("4361F0")).toBeCloseTo(relativeLuminance("#4361f0"), 10);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#4361F0", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#4361F0"), 10);
  });
});

describe("readableForeground", () => {
  // The whole point: a user can pick a pale card colour, and assuming white
  // would make the card face unreadable.
  it("picks dark ink on a pale fill", () => {
    expect(readableForeground("#FFE066")).toBe("#14141c");
  });

  it("picks white on a saturated brand fill", () => {
    expect(readableForeground("#4326C9")).toBe("#ffffff");
  });

  it("always returns the higher-contrast option", () => {
    for (const bg of ["#4361F0", "#FFE066", "#00A08A", "#8A8698", "#000000", "#ffffff"]) {
      const fg = readableForeground(bg);
      const other = fg === "#ffffff" ? "#14141c" : "#ffffff";
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
    }
  });
});

describe("gradientFrom", () => {
  it("produces a CSS linear-gradient containing the source colour", () => {
    const g = gradientFrom("#4361F0");
    expect(g).toMatch(/^linear-gradient\(/);
    expect(g.toLowerCase()).toContain("#4361f0");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- lib/color.test.ts`
Expected: FAIL — cannot resolve `./color`.

- [ ] **Step 3: Implement**

Create `lib/color.ts`:

```ts
/**
 * Colour maths for surfaces whose fill comes from user data.
 *
 * A stored account or category colour is an arbitrary hex — the user picked it,
 * and it may predate the palette brightening. Anything rendering text on top of
 * one has to measure rather than assume.
 */

const INK = "#14141c";
const PAPER = "#ffffff";

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white or near-black reads better on `background`. */
export function readableForeground(background: string): typeof PAPER | typeof INK {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK;
}

/**
 * A two-stop gradient derived from one colour, for card faces. The second stop
 * is the same hue darkened, so any user colour yields a plausible card without
 * needing a second stored value.
 */
export function gradientFrom(hex: string): string {
  const [r, g, b] = channels(hex);
  const dark = `#${[r, g, b]
    .map((c) => Math.round(c * 0.62).toString(16).padStart(2, "0"))
    .join("")}`;
  return `linear-gradient(135deg, ${hex} 0%, ${dark} 100%)`;
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- lib/color.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/color.ts lib/color.test.ts
git commit -m "feat(color): add luminance, contrast and gradient helpers"
```

---

## Task 7: Card network inference

**Files:**
- Create: `lib/accounts/network.ts`, `lib/accounts/network.test.ts`

**Interfaces:**
- Produces:
  - `type CardNetwork = "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay"`
  - `inferNetwork(name: string | null, brand?: string | null): CardNetwork | null`
  - `inferLast4(name: string | null, last4?: string | null): string | null`

- [ ] **Step 1: Write the failing test**

Create `lib/accounts/network.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { inferNetwork, inferLast4 } from "./network";

describe("inferNetwork", () => {
  it("prefers the stored brand over the name", () => {
    expect(inferNetwork("Some Bank Gold", "mastercard")).toBe("mastercard");
  });

  it("normalises a stored brand's case and spacing", () => {
    expect(inferNetwork(null, "  VISA ")).toBe("visa");
    expect(inferNetwork(null, "American Express")).toBe("amex");
  });

  it.each([
    ["Visa Platinum", "visa"],
    ["Mastercard Black", "mastercard"],
    ["Master Card Gold", "mastercard"],
    ["MC Classic", "mastercard"],
    ["Amex Gold", "amex"],
    ["American Express Platinum", "amex"],
    ["Discover it", "discover"],
    ["Diners Club", "diners"],
    ["JCB Standard", "jcb"],
    ["UnionPay Debit", "unionpay"],
  ])("infers %s as %s", (name, expected) => {
    expect(inferNetwork(name)).toBe(expected);
  });

  it("is case insensitive", () => {
    expect(inferNetwork("visa platinum")).toBe("visa");
  });

  // A wrong mark is worse than no mark.
  it("returns null when nothing matches", () => {
    expect(inferNetwork("Popular Platinum")).toBeNull();
    expect(inferNetwork("Savings")).toBeNull();
    expect(inferNetwork(null)).toBeNull();
    expect(inferNetwork("")).toBeNull();
  });

  // "mc" must not match inside a word.
  it("does not match mc inside another word", () => {
    expect(inferNetwork("McDonald's Rewards")).toBeNull();
    expect(inferNetwork("McKinsey Card")).toBeNull();
  });
});

describe("inferLast4", () => {
  it("prefers the stored last4", () => {
    expect(inferLast4("Visa 9999", "1234")).toBe("1234");
  });

  it("ignores a stored value that is not four digits", () => {
    expect(inferLast4("Visa 4821", "12")).toBe("4821");
  });

  it("infers a trailing four-digit group from the name", () => {
    expect(inferLast4("Visa Platinum 4821")).toBe("4821");
    expect(inferLast4("4821 Visa")).toBe("4821");
  });

  // "Amex 2024" is a vintage, not a card number.
  it("skips values that look like a year", () => {
    expect(inferLast4("Amex 2024")).toBeNull();
    expect(inferLast4("Card 1999")).toBeNull();
    expect(inferLast4("Card 2099")).toBeNull();
  });

  it("accepts four digits outside the year range", () => {
    expect(inferLast4("Card 1899")).toBe("1899");
    expect(inferLast4("Card 0042")).toBe("0042");
  });

  it("does not match inside a longer digit run", () => {
    expect(inferLast4("Account 123456")).toBeNull();
  });

  it("returns null when there is nothing to infer", () => {
    expect(inferLast4("Visa Gold")).toBeNull();
    expect(inferLast4(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- lib/accounts/network.test.ts`
Expected: FAIL — cannot resolve `./network`.

- [ ] **Step 3: Implement**

Create `lib/accounts/network.ts`:

```ts
/**
 * Card identity, inferred.
 *
 * `card_groups` stores `brand` and `last4`; a standalone credit-card account
 * has neither column, so for those the network and last four digits are
 * inferred from the account name. Inference is deliberately conservative: a
 * wrong network mark on someone's card is worse than a generic one.
 */

export type CardNetwork =
  | "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay";

/**
 * Ordered because the first match wins. Each pattern is anchored on word
 * boundaries — "mc" in particular must not match inside "McDonald".
 */
const PATTERNS: ReadonlyArray<readonly [CardNetwork, RegExp]> = [
  ["visa", /\bvisa\b/],
  ["mastercard", /\b(?:mastercard|master\s+card|mc)\b/],
  ["amex", /\b(?:amex|american\s+express)\b/],
  ["discover", /\bdiscover\b/],
  ["diners", /\bdiners(?:\s+club)?\b/],
  ["jcb", /\bjcb\b/],
  ["unionpay", /\b(?:unionpay|union\s+pay)\b/],
];

export function inferNetwork(
  name: string | null,
  brand?: string | null,
): CardNetwork | null {
  const haystack = `${brand ?? ""} ${name ?? ""}`.toLowerCase().trim();
  if (!haystack) return null;
  // The stored brand is searched first by sitting at the front of the haystack,
  // so an explicit value beats anything the name happens to contain.
  for (const [network, pattern] of PATTERNS) {
    if (pattern.test(haystack)) return network;
  }
  return null;
}

/** Four consecutive digits, not part of a longer run. */
const FOUR_DIGITS = /(?<!\d)(\d{4})(?!\d)/g;

export function inferLast4(
  name: string | null,
  last4?: string | null,
): string | null {
  if (last4 && /^\d{4}$/.test(last4)) return last4;
  if (!name) return null;
  for (const match of name.matchAll(FOUR_DIGITS)) {
    const value = match[1];
    const n = Number(value);
    // A plausible year is far more likely to be a vintage than a card number.
    if (n >= 1900 && n <= 2099) continue;
    return value;
  }
  return null;
}
```

Note: `inferNetwork` searches brand and name in one string with brand first. Because `PATTERNS` is scanned in order rather than by position, an explicit brand of "mastercard" on a card named "Visa Rewards" would still return `visa`. Fix this by checking brand alone first:

```ts
export function inferNetwork(
  name: string | null,
  brand?: string | null,
): CardNetwork | null {
  const fromBrand = match(brand);
  if (fromBrand) return fromBrand;
  return match(name);
}

function match(value: string | null | undefined): CardNetwork | null {
  const s = (value ?? "").toLowerCase().trim();
  if (!s) return null;
  for (const [network, pattern] of PATTERNS) {
    if (pattern.test(s)) return network;
  }
  return null;
}
```

Use this second form. The test `prefers the stored brand over the name` covers it.

- [ ] **Step 4: Run the test**

Run: `npm test -- lib/accounts/network.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/accounts/network.ts lib/accounts/network.test.ts
git commit -m "feat(accounts): infer card network and last4 from stored and named values"
```

---

## Task 8: The card face

**Files:**
- Create: `components/accounts/network-mark.tsx`, `components/accounts/payment-card.tsx`
- Modify: `components/accounts/card-group-tile.tsx`, `components/accounts/account-card.tsx`, `lib/accounts/queries.ts` (select `brand`, `last4`, `art_color`)

**Interfaces:**
- Consumes: `inferNetwork`, `inferLast4`, `CardNetwork`, `readableForeground`, `gradientFrom`, `MoneyDisplay`.
- Produces:
  - `<NetworkMark network={CardNetwork|null} className? />`
  - `<PaymentCard name={string} last4={string|null} network={CardNetwork|null} color={string|null} owed={number} currency={string} href?={string} className?={string} />`

- [ ] **Step 1: Widen the accounts query**

`card_groups.brand`, `.last4` and `.art_color` exist but are never selected. In `lib/accounts/queries.ts`, find the `card_groups` selection and add the three columns, extending the row type to match. Run `grep -n "card_group" lib/accounts/queries.ts` to locate it.

- [ ] **Step 2: Create the network marks**

Create `components/accounts/network-mark.tsx`. These are **simplified geometric marks**, not reproductions of the trademarks — they identify the user's own card:

```tsx
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * Simplified network marks, drawn in-repo. They are recognisable shorthand for
 * the network, deliberately not pixel-accurate reproductions of the brands'
 * trademarks, and are used only to label a card the user already owns.
 */
export function NetworkMark({
  network,
  className,
}: {
  network: CardNetwork | null;
  className?: string;
}) {
  const base = cn("h-6 w-auto", className);

  if (network === "mastercard") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Mastercard">
        <circle cx="18" cy="15" r="11" fill="currentColor" opacity="0.9" />
        <circle cx="30" cy="15" r="11" fill="currentColor" opacity="0.55" />
      </svg>
    );
  }
  if (network === "amex") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="American Express">
        <rect x="4" y="3" width="40" height="24" rx="4" fill="currentColor" opacity="0.9" />
        <text x="24" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--card)">
          AMEX
        </text>
      </svg>
    );
  }
  if (network) {
    // visa, discover, diners, jcb, unionpay — a wordmark-style label.
    return (
      <span className={cn("text-sm font-extrabold tracking-widest uppercase", className)}>
        {network === "unionpay" ? "UnionPay" : network}
      </span>
    );
  }
  // No network known: a neutral chip stands in so the corner is not empty.
  return (
    <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Card">
      <rect x="6" y="8" width="20" height="14" rx="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
```

- [ ] **Step 3: Create PaymentCard**

Create `components/accounts/payment-card.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoneyDisplay } from "@/components/ui/money-display";
import { NetworkMark } from "./network-mark";
import { readableForeground, gradientFrom } from "@/lib/color";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * A credit card rendered as the physical object.
 *
 * Aspect ratio is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm), the real card shape.
 *
 * The foreground is MEASURED from the resolved fill rather than assumed white:
 * the fill can come from a user-chosen account colour, and white on a pale
 * yellow card is unreadable.
 */
export function PaymentCard({
  name,
  last4,
  network,
  color,
  owed,
  currency,
  href,
  className,
}: {
  name: string;
  last4: string | null;
  network: CardNetwork | null;
  color: string | null;
  owed: number;
  currency: string;
  href?: string;
  className?: string;
}) {
  const t = useTranslations("Accounts");
  const fill = color ?? "#4326C9";
  const fg = readableForeground(fill);

  const body = (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold opacity-90">{name}</p>
        <NetworkMark network={network} className="shrink-0 opacity-90" />
      </div>

      <p className="font-mono text-base tracking-[0.18em] opacity-85">
        {`•••• •••• •••• ${last4 ?? "••••"}`}
      </p>

      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-70">{t("owed")}</p>
        <MoneyDisplay amount={owed} currency={currency} size="stat" />
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="lift block">
      {body}
    </Link>
  ) : (
    body
  );
}
```

- [ ] **Step 4: Render the face at group level**

In `components/accounts/card-group-tile.tsx`, replace the header block at `:19-27` with a `PaymentCard`. The group **is** the physical card, so the face, the mark and the digits render once here, and the currency lines stay as rows beneath it. Pass `brand`/`last4`/`art_color` from the group row through `inferNetwork` / `inferLast4`, sum the lines' `owed` for the face's figure, and keep the existing per-line `Link` rows — restyled with `MoneyDisplay size="inline"`.

The component currently takes only `{ name, accounts }`. Extend its props to `{ name, brand, last4, artColor, accounts }` and update its call site in `components/accounts/account-gallery.tsx`.

- [ ] **Step 5: Render the face for standalone cards**

In `components/accounts/account-card.tsx`, when `type === "credit_card"` **and** the account has no `card_group_id`, render `PaymentCard` instead of the current `Card` + `CardBody`. Derive network and last4 from `account.name` alone (there is no stored brand on `accounts`). Cards that belong to a group must **not** render a face here — the gallery already renders their group tile, and a second face would double-count.

Leave `CardBody`'s utilization and due-day logic reachable: render it beneath the face, not inside it.

- [ ] **Step 6: Build and review**

Run: `npm run build`
Expected: succeeds.

Visually confirm: a card group shows exactly one face; a standalone Visa shows a face with a VISA mark; an account named "Savings" is unaffected.

- [ ] **Step 7: Commit**

```bash
git add components/accounts lib/accounts/queries.ts
git commit -m "feat(accounts): render credit cards as physical card faces"
```

---

## Task 9: Budgets, transactions and the four duplicates

**Files:**
- Modify: `components/budgets/budget-grid.tsx:243-340`, `components/transactions/transaction-row.tsx:86-124`, `components/goals/goal-grid.tsx:113`

- [ ] **Step 0: Unblock goal-grid.tsx**

Task 4 removed `colorCardStyle` from `lib/palette.ts`. `components/goals/goal-grid.tsx:113` is a third call site the original plan missed — found by Task 4's implementer, who correctly left it untouched since it wasn't in that task's scope. It currently reads:

```tsx
<Card key={goal.id} className="gap-0 p-5" style={colorCardStyle(goal.color)}>
```

Goals is inherit-only per the spec (tokens and components, no bespoke layout work), so this is a mechanical unblock, not a redesign: drop the `style={colorCardStyle(goal.color)}` prop entirely and remove the now-dead `import { colorCardStyle } from "@/lib/palette"` at the top of the file. The card loses its 5% colour wash and falls back to the plain `Card` background — that is the correct outcome for an inherit-only surface, not a regression to fix later.

Run `grep -rn "colorCardStyle" --include=*.ts --include=*.tsx app components lib` after this step and confirm it returns nothing.

- [ ] **Step 1: Replace both budget tile blocks**

`budget-grid.tsx` contains the duplicated tile twice (`:246-254` and `:328-336`) plus two `colorCardStyle` calls (`:243`, `:325`). Replace each tile with `<ColorTile color={row.color} emoji={row.emoji} name={row.name} size="md" />` and delete the `colorCardStyle` style props and the now-unused import.

Give each budget row the full treatment: `MoneyDisplay size="stat"` for the amount and `StatPill` for the percentage, toned `destructive` when over budget and `neutral` otherwise.

- [ ] **Step 2: Replace the transaction row tile**

In `transaction-row.tsx`, replace `:86-96` with:

```tsx
      <ColorTile
        color={category?.color ?? null}
        emoji={category?.emoji}
        name={category?.name}
        icon={Icon}
        size="md"
      />
```

- [ ] **Step 3: Convert the inline badges**

Replace the four hand-rolled spans at `:101-124` with the `Badge` component, preserving each one's tone and its `title` attribute on the FX warning. Do not change any of the conditions — `isStatementCredit`, `fx_fallback`, `exclude_from_budget` and `statement_line_id` all carry meaning established elsewhere.

- [ ] **Step 4: Add sticky date-pill section headers**

The ledger currently runs as one undifferentiated list. Group rows by month in `components/transactions/ledger.tsx` and render a sticky pill header per group:

```tsx
<h2 className="sticky top-0 z-10 -mx-1 mb-1 py-2">
  <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
    {label}
  </span>
</h2>
```

`label` comes from `next-intl`'s date formatting, not a hardcoded string — reuse the pattern already in `app/(app)/page.tsx:30` (`Intl.DateTimeFormat(locale, …)`). Group by the transaction's month so the labels read "August 2026" / "agosto de 2026" per locale.

Sticky positioning needs an ancestor without `overflow: hidden`. `Card` sets `overflow-hidden` (`components/ui/card.tsx:18`), so these headers must sit **outside** any `Card`, or the card must be given `overflow-visible`. Verify the header actually sticks before moving on.

- [ ] **Step 5: Confirm the duplication is gone**

Run: `grep -rn "color-mix(in oklab, \${" --include=*.tsx components | grep -v color-tile`
Expected: no output. Four copies became one.

Run: `grep -rn "colorCardStyle" --include=*.ts --include=*.tsx app components lib`
Expected: no output.

- [ ] **Step 6: Build and test**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add components/budgets components/transactions
git commit -m "refactor(ui): replace four duplicated tiles with ColorTile"
```

---

## Task 10: HeroCard and the overview

**Files:**
- Create: `components/ui/hero-card.tsx`
- Modify: `app/(app)/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Create HeroCard**

```tsx
import { cn } from "@/lib/utils";

/** The signature gradient slab. The one object that does not invert by theme. */
export function HeroCard({
  label,
  children,
  action,
  className,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-[image:var(--hero)] p-7 text-(--hero-foreground) shadow-(--shadow-card)",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-white/10 blur-2xl"
      />
      <p className="relative text-sm font-medium opacity-80">{label}</p>
      <div className="relative mt-2">{children}</div>
      {action ? <div className="relative mt-6 flex gap-3">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 2: Rebuild the overview hero**

In `app/(app)/page.tsx`, replace the net-worth `Card` at `:93-112` with `HeroCard` containing `<MoneyDisplay size="hero" />`. Do the same for the empty-state card at `:44-58`. Both currently use a radial-gradient wash div that `HeroCard` supersedes — delete those.

- [ ] **Step 3: Restyle the stat cards**

The three cards at `:116-139` each get a `ColorTile` and `MoneyDisplay size="stat"`. Replace the budget bar's raw div at `:133-138` with a `StatPill` showing the percentage plus the existing bar, and keep the `bar-fill` class and `--i` stagger.

- [ ] **Step 4: Restyle the upcoming rail**

Rows at `:154-171` take `ColorTile size="md"` and `MoneyDisplay size="inline"`.

- [ ] **Step 5: Add any new copy to both locales**

If steps 2-4 introduced any new string, add it to `messages/en.json` **and** `messages/es.json`. If none were added, state that explicitly.

Run: `npm run build`
Expected: succeeds. A missing `es` key throws at request time, not build time, so also load `/` with the Spanish locale before committing.

- [ ] **Step 6: Commit**

```bash
git add components/ui/hero-card.tsx app/\(app\)/page.tsx messages
git commit -m "feat(overview): lead with the hero balance slab"
```

---

## Task 11: Shell

**Files:**
- Modify: `components/shell/nav-link.tsx`, `components/shell/bottom-nav.tsx`, `components/shell/sidebar.tsx`, `components/quick-add/quick-add-button.tsx`, `components/shell/app-shell.tsx:45`

- [ ] **Step 1: Fill the active nav state**

In `nav-link.tsx`, change the active treatment for both `side` and `bottom` variants to a filled pill: `bg-sidebar-primary text-sidebar-primary-foreground rounded-full` for the sidebar, and a filled pill behind the icon for the bottom bar. Read the file first — it has two variants and existing active/hover logic to preserve.

- [ ] **Step 2: Float the bottom bar**

In `bottom-nav.tsx:12-17`, change the fixed bar to float: inset from the edges, `rounded-full`, `bg-card/90 backdrop-blur`, `shadow-(--shadow-card)`.

**Preserve both existing behaviours:** the `env(safe-area-inset-bottom)` padding, and the equal-column `gridTemplateColumns` that stops the long Spanish label "Transacciones" from stealing width. Verify in Spanish at 360px width.

- [ ] **Step 3: Brand the quick-add button**

In `quick-add-button.tsx`, apply the hero gradient and grow it to 60px.

- [ ] **Step 4: Re-derive the main padding**

`app-shell.tsx:45` reserves `9rem` of bottom padding, sized to clear the old 56px bar and the old FAB. Both changed. Measure the new bar's top edge plus the FAB and update the value, keeping `env(safe-area-inset-bottom)` in the calc. Scroll to the bottom of `/transactions` on a phone viewport and confirm the last row clears both.

- [ ] **Step 5: Build and review in both locales**

Run: `npm run build`
Expected: succeeds. Check `/` at 360px in en and es, light and dark.

- [ ] **Step 6: Commit**

```bash
git add components/shell components/quick-add
git commit -m "feat(shell): filled nav pills and a floating bottom bar"
```

---

## Task 12: Insights and charts

**Files:**
- Modify: `app/globals.css` (the `--chart-*` blocks), `components/insights/spend-donut.tsx`, `components/insights/*.tsx`

- [ ] **Step 1: Repalette the chart series**

Replace `--chart-1` with the brand violet in both themes and re-space the remaining seven. Light: `#6C4EF5, #CE830A, #00A08A, #E85B3F, #9B4FBC, #899C39, #1A96CE, #DB4A76`. Dark: lift each into the dark band as the existing comment at `app/globals.css:269-270` describes.

- [ ] **Step 2: Verify the series still passes its own criteria**

The existing rationale requires a lightness band, a chroma floor, adjacent-pair separation under CVD simulation, and ≥3:1 against the surface. Extend `lib/palette.test.ts` with a contrast assertion over the eight light values against `#ffffff` and the eight dark values against `#16161f`.

Run: `npm test -- lib/palette.test.ts`
Expected: PASS.

- [ ] **Step 3: Thicken the donut**

In `spend-donut.tsx`, raise the arc thickness, round the segment caps, and place the total in the centre using `MoneyDisplay size="stat"`.

- [ ] **Step 4: Build**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/insights lib/palette.test.ts
git commit -m "feat(insights): repalette charts and thicken the donut"
```

---

## Task 13: Illustrations, login and marketing

**Files:**
- Create: `components/brand/spot-illustration.tsx`
- Modify: `app/login/page.tsx:26-46`, `components/marketing/marketing-home.tsx`, `components/empty-state.tsx`

- [ ] **Step 1: Build the spot illustrations**

Create `components/brand/spot-illustration.tsx` exporting flat SVG scenes keyed by name. Constraints: brand tokens and `currentColor` only, no external assets, `aria-hidden` on every one (they are decorative and always accompany a heading), and legible on both themes.

Follow this shape exactly — the point is stacked geometric planes in tints of one hue, not detailed drawing:

```tsx
const SCENES = {
  wallet: (
    <>
      <rect x="18" y="46" width="84" height="56" rx="12" fill="var(--brand)" opacity="0.25" />
      <rect x="30" y="34" width="84" height="56" rx="12" fill="var(--brand)" opacity="0.55" />
      <circle cx="96" cy="62" r="8" fill="var(--brand)" />
    </>
  ),
  chart: (
    <>
      <rect x="24" y="70" width="18" height="34" rx="6" fill="var(--brand)" opacity="0.35" />
      <rect x="52" y="48" width="18" height="56" rx="6" fill="var(--brand)" opacity="0.6" />
      <rect x="80" y="28" width="18" height="76" rx="6" fill="var(--brand)" />
    </>
  ),
  empty: (
    <>
      <circle cx="64" cy="64" r="38" fill="var(--brand)" opacity="0.18" />
      <rect x="44" y="58" width="40" height="8" rx="4" fill="var(--brand)" opacity="0.7" />
    </>
  ),
} as const;

export function SpotIllustration({
  scene,
  className,
}: {
  scene: keyof typeof SCENES;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden className={className}>
      {SCENES[scene]}
    </svg>
  );
}
```

These render on `--card` in both themes; `--brand` shifts per theme so the tints stay legible on either. Check each scene on both before moving on.

- [ ] **Step 2: Rebuild the login hero**

`app/login/page.tsx:26-46` uses `bg-brand-panel` and `text-brand-panel-foreground`, which Task 1 removed. This file is the **only** consumer of those tokens, so it must be updated or the build breaks. Replace with `bg-[image:var(--hero)]` and `text-(--hero-foreground)`, drop the two decorative ring divs at `:42-46`, and place a spot illustration.

- [ ] **Step 3: Restyle the marketing home**

Apply `HeroCard`, the new button sizes, and a spot illustration.

- [ ] **Step 4: Give empty states their art**

In `components/empty-state.tsx`, add an optional illustration slot and use it on the overview and accounts empty states.

- [ ] **Step 5: Build and verify no dangling tokens**

Run: `grep -rn "brand-panel" --include=*.tsx --include=*.ts --include=*.css app components lib`
Expected: no output.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/brand app/login components/marketing components/empty-state
git commit -m "feat(brand): illustrated login, marketing and empty states"
```

---

## Task 14: Motion and celebration

**Files:**
- Modify: `app/globals.css:326-337` and `:402-433` and `:529-557`
- Create: `components/ui/count-up.tsx`

- [ ] **Step 1: Update the motion note**

`app/globals.css:326-337` documents `MOTION_INTENSITY 5 of 10` and states motion "never decorates". Raise it to 7 and rewrite the rationale to match the new brief: motion now also carries delight, while remaining fully gated behind `prefers-reduced-motion`.

- [ ] **Step 2: Spring the press**

At `:429-432`, change `.lift:active` from `scale(0.995)` to `scale(0.96)` and shorten the duration.

- [ ] **Step 3: Build the count-up**

Create `components/ui/count-up.tsx`: a client component animating a number from 0 to its value with `requestAnimationFrame`.

Three requirements: it must respect `window.matchMedia("(prefers-reduced-motion: reduce)")` and render the final value immediately when set; it must render the **final value on first paint** for SSR so there is no hydration mismatch; and it must not animate when figure masking is on.

Wire it into `MoneyDisplay` behind an opt-in `animate` prop, used on the overview hero and stat cards only.

- [ ] **Step 4: Celebrate a reached goal**

In the goals UI, when a goal's progress reaches 100%, fire a CSS burst and call the existing `playSuccess` from `components/sound/sound-provider.tsx:31`. It must fire once per arrival, not on every render.

- [ ] **Step 5: Extend the reduced-motion reset**

Add every new animation to the `prefers-reduced-motion: reduce` block at `:533-557`, each explicitly reset to its end state. The existing comment warns that `animation: none` with `fill-mode: both` strands elements at `opacity: 0` — follow the established pattern.

- [ ] **Step 6: Verify reduced motion**

In DevTools, emulate `prefers-reduced-motion: reduce`, reload `/`, and confirm every figure, bar and card is visible and final. Nothing may be invisible.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/ui/count-up.tsx components/goals components/ui/money-display.tsx
git commit -m "feat(motion): count-up figures, springier presses, goal celebration"
```

---

## Task 15: Sweep and verify

**Files:** any page needing correction.

- [ ] **Step 1: Walk every route**

Visit all of: `/`, `/accounts`, `/accounts/[id]`, `/transactions`, `/budgets`, `/budgets/goals`, `/budgets/goals/[id]`, `/subscriptions`, `/insights`, `/settings`, `/help`, `/login`, `/welcome`, `/privacy`, `/terms`.

For each: light and dark, en and es, 360px and 1440px. The inherit-only pages matter most here — the Task 5 button resize moved layouts on pages nobody redesigned.

- [ ] **Step 2: Check for horizontal scroll**

At 360px, confirm no route scrolls sideways. `app-shell.tsx:35-39` documents a `min-w-0` fix for exactly this; long imported merchant names are the usual trigger. Check `/transactions` with imported statement data.

- [ ] **Step 3: Verify masking end to end**

Toggle figure masking and confirm every money figure masks — the hero, stat cards, card faces, budget tiles, transaction rows, insights.

- [ ] **Step 4: Verify the pre-migration state**

The palette migration may not be pushed yet. Confirm the app renders correctly with **old** stored hex values: tiles, card faces and charts must all look right. If anything assumes a new value, fix it.

- [ ] **Step 5: Full verification**

Run: `npm run lint`
Expected: clean.

Run: `npm test`
Expected: all pass, including the new `palette`, `money-parts`, `color` and `network` suites.

Run: `npm run build`
Expected: succeeds.

Report the actual output of all three. Do not claim success without it.

- [ ] **Step 6: Commit and summarise**

```bash
git add -A
git commit -m "fix(design): sweep corrections across inherited surfaces"
```

Then report to the user: what changed, what still needs their action (**pushing `supabase/migrations/20260804120000_brighten_palette.sql`**), and anything deferred.

---

## Deferred / follow-up

- `card_groups.art_url` as a card background image (column exists, unused).
- `accounts.last4` / `accounts.brand` columns to make standalone cards first-class instead of inferring from the name — needs a migration and form UI.
- Settings, Help, Subscriptions, Goals and legal pages get tokens only; bespoke layout work on those was explicitly out of scope.
