# Papel Moneda App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skill:** every UI task runs under `/impeccable` (the project's design skill, `.claude/skills/impeccable`). Load `reference/craft-floor.md` before editing UI.

**Goal:** Move the whole Cashly domain (the signed-in app, `/welcome`, `/help`, legal) into the Papel Moneda world that the home page and `/login` already use.

**Architecture:** Phase 0 promotes the Papel tokens and Archivo from the marketing CSS module to the global theme. It builds a small primitive layer in `components/papel/` (Note, Stamp, LedgerRow, ProofMark, Perforation, RuleMeter, SpecimenFrame, Seal), and re-points the incumbent primitives (`Card`, `HeroCard`, `ColorTile`, `Button`, inputs, dialogs, shell) at it, so every screen changes at once without touching screen logic. Phases 1–6 then recompose one screen family each from impeccable comp rounds. Phase 7 deletes the incumbent system and writes one DESIGN.md.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`@theme inline` in `app/globals.css`), shadcn on `@base-ui/react`, next-intl, next-themes, Vitest, `next/font/google` (Archivo, `wdth` axis), canvas guilloche, Node WAV synthesis (`scripts/generate-sounds.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` (read it first; this plan argues from it). World reference: `DESIGN.md`, `components/marketing/papel/`.

## Global Constraints

- One family: **Archivo** with the `wdth` axis. The expanded cut is for legends and denomination numerals, the normal cut for body. Tabular numerals on every amount. Plus Jakarta Sans and Inter are removed.
- Tokens (verbatim from DESIGN.md): note `#4a1f8c` / `#2b1157` / `#a488ec`, note ink `#f8f5ff` / `#d9ccfa`, peso `#e0661c` / `#ffb27a`, peso ink `#1f0e22` / `#4a2410`, paper `#eeebf5` / `#ffffff` / `#cdc3e3`, ink `#1b1530` / `#544a6c`, teal `#0e6e60`, red `#b3302a`. Dark paper: `#15111f` / `#1d1829` / `#3b3252`, ink `#efebf8` / `#b2a8c9`, teal `#4fc2ae`, red `#f0766c`.
- Note fields (violet, peso) **never invert**. Paper goes ink-dark at night. Light is the default theme.
- **At most one Note per screen.** Guilloche, microprint and serials appear only on Notes, the Seal, the splash and empty states, never on list rows or forms.
- State is shown by ink density, rule weight or a glyph, **never colour alone**.
- Category and account colours are user data (any hex). Text is never set in a user hex, and glyph ink must clear 3:1 against the surface.
- WCAG 2.2 AA: 4.5:1 for body text, keyboard-complete, visible focus (2px currentColor outline), `prefers-reduced-motion` honoured with end states.
- i18n: no hardcoded copy, and en and es change together. Microprint and bank terms (cuotas, quincena) stay Spanish in both. The in-app help guide (page + mocks, en + es) is updated in the same phase as the screen it documents.
- No database migration. If one turns out to be needed, stop: the human pushes it and the UI must render both before and after.
- Screen logic, queries, server actions, routes and message keys stay. Copy may be added, but never silently replaced.
- Keep the incumbent mobile fixes: safe-area insets, `min-w-0` on the shell column, truncation at 360px Spanish, FAB clearance.
- Machine rules: ask before starting a dev server. Run one server on a fixed port with `run_in_background` and stop it in the same turn. Use `agent-browser` with a named session (`agent-browser session id --scope worktree --prefix tywin`) and close it.
- Branch per phase: create the branch, and when done merge to `main` and delete it locally and remotely. Verify git state with `git --no-pager` (the RTK proxy mangles git output). Ask before creating a worktree.
- Each commit message ends with the session attribution lines.

## File Structure

**Phase 0 creates**
- `design/tokens.json`: platform-neutral token source (light, dark, fixed). Also consumed by the Expo repo.
- `design/tokens.test.ts`: asserts `app/globals.css` matches the JSON.
- `app/fonts.ts`: the single Archivo instance (moved from `components/marketing/papel/fonts.ts`).
- `components/papel/guilloche.tsx`: moved from marketing (canvas drawing only).
- `components/papel/microprint.tsx` + `components/papel/ornament.module.css`: moved Microprint/Serial and their rules.
- `components/papel/note.tsx`: the banknote field for a screen's one figure.
- `components/papel/stamp.tsx`: the user-colour ink stamp.
- `components/papel/ledger-row.tsx`: the ruled list row.
- `components/papel/proof-mark.tsx`: the check / cross / dot mark with a label.
- `components/papel/perforation.tsx` + `lib/papel/perforation.ts` (+ test): cuota strips.
- `components/papel/rule-meter.tsx` + `lib/papel/meter.ts` (+ test): ruled progress.
- `components/papel/specimen-frame.tsx`: the dashed "Ejemplo" frame.
- `components/papel/seal.tsx`: the engraved Cashly seal (logo).
- `lib/papel/ink.ts` (+ test): `stampInk()`, the contrast-safe ink for any hex.
- `lib/papel/rosette.ts` (+ test): the rosette geometry and `rosettePath()` for static SVG.

**Phase 0 modifies:** `app/globals.css`, `app/layout.tsx`, `lib/palette.test.ts`, `components/marketing/papel/{fonts.ts,papel.module.css,marketing-home imports}`, `app/login/page.tsx` and `components/auth/login-form.tsx` (imports only), `components/ui/{button,card,input,textarea,select,dialog,dropdown-menu,tabs,switch,badge,progress,stat-pill,hero-card,color-tile,sonner}.tsx`, `components/brand/logo.tsx`, `components/shell/{sidebar,mobile-header,bottom-nav,nav-link,activity-sheet,splash,app-shell}.tsx`, `components/quick-add/quick-add-button.tsx`, `lib/pwa/{icon.tsx,theme-color.ts}`, `app/manifest.ts`, `scripts/generate-sounds.mjs` (+ test), `components/sound/sound-provider.tsx`, `DESIGN.md`.

**Phases 1–6** recompose screens under `app/(app)/**`, `app/welcome`, `app/(app)/help`, `app/{terms,privacy}` and their `components/<feature>/` folders. **Phase 2** adds `components/papel/card-face.tsx`, the single card face shared by the home page and the app.

---

# Phase 0 — Foundation (branch `redesign/papel-foundation`)

### Task 1: Token source and globals remap

**Files:**
- Create: `design/tokens.json`, `design/tokens.test.ts`
- Modify: `app/globals.css` (`:root` and `.dark` blocks, `--radius`, shadows)
- Modify: `lib/palette.test.ts` (dark surface constant)
- Modify: `components/marketing/papel/papel.module.css:17-58` (drop the token declarations now provided globally)

**Interfaces:**
- Produces CSS custom properties available everywhere: `--note --note-deep --note-line --note-ink --note-ink-soft --peso --peso-line --peso-ink --peso-ink-soft --paper --paper-2 --paper-line --ink --ink-soft --rule --teal --red --ease-press`. Every existing shadcn token (`--background`, `--card`, `--primary`, `--brand`, …) is remapped onto them.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b redesign/papel-foundation
```

- [ ] **Step 2: Write `design/tokens.json`**

```json
{
  "$comment": "Papel Moneda tokens. Source of truth for app/globals.css (checked by design/tokens.test.ts) and for the Expo app. 'fixed' never inverts.",
  "fixed": {
    "note": "#4a1f8c", "note-deep": "#2b1157", "note-line": "#a488ec",
    "note-ink": "#f8f5ff", "note-ink-soft": "#d9ccfa",
    "peso": "#e0661c", "peso-line": "#ffb27a",
    "peso-ink": "#1f0e22", "peso-ink-soft": "#4a2410"
  },
  "light": {
    "paper": "#eeebf5", "paper-2": "#ffffff", "paper-line": "#cdc3e3",
    "ink": "#1b1530", "ink-soft": "#544a6c", "rule": "#1b1530",
    "teal": "#0e6e60", "red": "#b3302a"
  },
  "dark": {
    "paper": "#15111f", "paper-2": "#1d1829", "paper-line": "#3b3252",
    "ink": "#efebf8", "ink-soft": "#b2a8c9", "rule": "#efebf8",
    "teal": "#4fc2ae", "red": "#f0766c"
  }
}
```

- [ ] **Step 3: Write the failing test `design/tokens.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import tokens from "./tokens.json";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (marker: string) => {
  const at = CSS.indexOf(marker);
  expect(at, marker).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
};
const ROOT = block("\n:root {");
const DARK = block("\n.dark {");
const value = (b: string, name: string) =>
  b.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]?.toLowerCase();

describe("design/tokens.json ↔ app/globals.css", () => {
  it("declares every fixed token in :root and never overrides it in .dark", () => {
    for (const [name, hex] of Object.entries(tokens.fixed)) {
      expect(value(ROOT, name), `:root --${name}`).toBe(hex);
      expect(value(DARK, name), `.dark must not set --${name}`).toBeUndefined();
    }
  });
  it("matches the light theme", () => {
    for (const [name, hex] of Object.entries(tokens.light)) expect(value(ROOT, name), name).toBe(hex);
  });
  it("matches the dark theme", () => {
    for (const [name, hex] of Object.entries(tokens.dark)) expect(value(DARK, name), name).toBe(hex);
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npx vitest run design/tokens.test.ts`
Expected: FAIL. `:root --note` is `undefined`.

- [ ] **Step 5: Remap `app/globals.css`**

In the `:root` block, add the Papel tokens at the top and remap the shadcn tokens onto them. Keep the existing comments that still apply, and rewrite the identity-colour header comment to describe Papel: paper, ink, the two note fields, and user ink stamps.

```css
:root {
  /* Papel Moneda — see design/tokens.json (tested against this block). */
  --note: #4a1f8c;
  --note-deep: #2b1157;
  --note-line: #a488ec;
  --note-ink: #f8f5ff;
  --note-ink-soft: #d9ccfa;
  --peso: #e0661c;
  --peso-line: #ffb27a;
  --peso-ink: #1f0e22;
  --peso-ink-soft: #4a2410;
  --paper: #eeebf5;
  --paper-2: #ffffff;
  --paper-line: #cdc3e3;
  --ink: #1b1530;
  --ink-soft: #544a6c;
  --rule: #1b1530;
  --teal: #0e6e60;
  --red: #b3302a;
  --ease-press: cubic-bezier(0.16, 1, 0.3, 1);

  --background: #eeebf5;
  --foreground: #1b1530;
  --card: #ffffff;
  --card-foreground: #1b1530;
  --popover: #ffffff;
  --popover-foreground: #1b1530;
  /* The primary action prints in note violet in BOTH themes: a note field
     never inverts, and a primary button is a small piece of note. */
  --primary: #4a1f8c;
  --primary-foreground: #f8f5ff;
  --secondary: #e4dff0;
  --secondary-foreground: #1b1530;
  --secondary-hover: #d9d2ea;
  --muted: #e4dff0;
  --muted-foreground: #544a6c;
  --accent: #e4dff0;
  --accent-foreground: #1b1530;
  --brand: #4a1f8c;
  --brand-foreground: #f8f5ff;
  --brand-muted: #e4dcf7;
  --destructive: #b3302a;
  --destructive-foreground: #ffffff;
  --success: #0e6e60;
  --success-foreground: #ffffff;
  --warning: #a14a0f;
  --warning-foreground: #ffffff;
  --gold: #a14a0f;
  --gold-foreground: #ffffff;
  --border: #cdc3e3;
  --input: #544a6c;
  --ring: #4a1f8c;

  /* Kept until Phase 7 for HeroCard callers; a flat note, no glow. */
  --hero: linear-gradient(160deg, #4a1f8c 0%, #2b1157 100%);
  --hero-foreground: #f8f5ff;

  /* chart-1 is the lead series and must equal --ring (lib/palette.test.ts). */
  --chart-1: #4a1f8c;
  /* --chart-2 … --chart-8: unchanged until Phase 5 */

  /* Engraved, not rounded: sheets are cut paper. */
  --radius: 0.25rem;

  /* Paper has no drop shadow; a hairline frame does the separating. */
  --shadow-card: 0 0 0 1px var(--paper-line);
  --shadow-card-hover: 0 0 0 1px var(--ink-soft);
  --shadow-float: 0 6px 14px -6px rgb(43 17 87 / 0.55);

  --sidebar: #eeebf5;
  --sidebar-foreground: #1b1530;
  --sidebar-primary: #4a1f8c;
  --sidebar-primary-foreground: #f8f5ff;
  --sidebar-accent: #e4dff0;
  --sidebar-accent-foreground: #1b1530;
  --sidebar-border: #1b1530;
  --sidebar-ring: #4a1f8c;
}
```

In the `.dark` block, set only the theme tokens (never the fixed ones) and keep the surface ladder strictly increasing: `background < card < muted < popover < accent < secondary < border < input`.

```css
.dark {
  --paper: #15111f;
  --paper-2: #1d1829;
  --paper-line: #3b3252;
  --ink: #efebf8;
  --ink-soft: #b2a8c9;
  --rule: #efebf8;
  --teal: #4fc2ae;
  --red: #f0766c;

  --background: #15111f;
  --foreground: #efebf8;
  --card: #1d1829;
  --card-foreground: #efebf8;
  --muted: #221c30;
  --muted-foreground: #b2a8c9;
  --popover: #282137;
  --popover-foreground: #efebf8;
  --primary: #4a1f8c;
  --primary-foreground: #f8f5ff;
  --accent: #2f2742;
  --accent-foreground: #efebf8;
  --secondary: #372e4d;
  --secondary-foreground: #efebf8;
  --secondary-hover: #41375a;
  --border: #3b3252;
  --input: #4a4064;
  --brand: #a488ec;
  --brand-foreground: #1b1530;
  --brand-muted: #2f2742;
  --destructive: #f0766c;
  --destructive-foreground: #1f0705;
  --success: #4fc2ae;
  --success-foreground: #04140b;
  --warning: #ffb27a;
  --warning-foreground: #1f0e22;
  --gold: #ffb27a;
  --gold-foreground: #1f0e22;
  --ring: #a488ec;
  --chart-1: #a488ec;
  /* --chart-2 … --chart-8: unchanged until Phase 5 */
  --shadow-card: 0 0 0 1px var(--paper-line);
  --shadow-card-hover: 0 0 0 1px var(--ink-soft);
  --shadow-float: 0 6px 14px -6px rgb(0 0 0 / 0.7);
  --sidebar: #15111f;
  --sidebar-foreground: #efebf8;
  --sidebar-primary: #4a1f8c;
  --sidebar-primary-foreground: #f8f5ff;
  --sidebar-accent: #221c30;
  --sidebar-accent-foreground: #efebf8;
  --sidebar-border: #efebf8;
  --sidebar-ring: #a488ec;
}
```

- [ ] **Step 6: Point `lib/palette.test.ts` at the new dark surface**

Change `const CARD_DARK = luminance("#16161f");` to `const CARD_DARK = luminance("#1d1829");` and update its comment to say it is Papel's dark `--paper-2`.

- [ ] **Step 7: Drop the duplicated tokens from the marketing module**

In `components/marketing/papel/papel.module.css`, delete the custom-property declarations inside `.page` (`--note` … `--ease-press`, keeping `--gutter`) and delete the whole `:global(.dark) .page { … }` token block. The page keeps working because `:root` and `.dark` now provide the same names and values.

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run design/tokens.test.ts lib/palette.test.ts && npx tsc --noEmit`
Expected: PASS (both suites) and no type errors.

- [ ] **Step 9: Commit**

```bash
git add design app/globals.css lib/palette.test.ts components/marketing/papel/papel.module.css
git commit -m "feat(design): Papel Moneda tokens promoted to the global theme"
```

### Task 2: Archivo app-wide

**Files:**
- Create: `app/fonts.ts`
- Modify: `components/marketing/papel/fonts.ts`, `app/layout.tsx`, `app/globals.css` (`@theme inline` font roles, `html` weight, `.figure`)

**Interfaces:**
- Produces `archivo` (exported from `@/app/fonts`) and the CSS variable `--font-archivo` on `<html>`. `--font-sans`, `--font-display` and `.figure` all resolve to Archivo.

- [ ] **Step 1: Create `app/fonts.ts`**

```ts
import { Archivo } from "next/font/google";

/* The one Cashly face (Papel Moneda). The width axis is the point: the
   expanded cut is the engraved legend and denomination numerals, the normal
   cut is body. One family, one numeral system. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
```

- [ ] **Step 2: Re-export from the marketing module**

Replace the body of `components/marketing/papel/fonts.ts` with:

```ts
export { archivo } from "@/app/fonts";
```

- [ ] **Step 3: Swap the fonts in `app/layout.tsx`**

Remove the `Plus_Jakarta_Sans, Inter` import and both font constants. Add `import { archivo } from "./fonts";` and change the `<html>` className to:

```tsx
className={`${archivo.variable} h-full antialiased`}
```

- [ ] **Step 4: Re-point the type roles in `app/globals.css`**

```css
  --font-sans: var(--font-archivo), system-ui, sans-serif;
  --font-serif: var(--font-archivo), system-ui, sans-serif;
  --font-display: var(--font-archivo), system-ui, sans-serif;
```

In `@layer base` `html`, change `font-weight: 450;` to `font-weight: 400;` and replace the comment with one line: "Archivo's 400 is the body weight; figures and legends set their own." In `@layer components`, set `.figure { font-family: var(--font-archivo), system-ui, sans-serif; font-variant-numeric: tabular-nums lining-nums; letter-spacing: 0; font-weight: inherit; }` and add a sibling utility for legends:

```css
  /* Engraved legend: the banknote's wide caps. */
  .legend {
    font-stretch: 125%;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
```

- [ ] **Step 5: Check for stray font variables**

Run: `rg -n "font-jakarta|font-inter" --glob '!node_modules' --glob '!.next'`
Expected: matches only in `components/marketing/papel/papel.module.css` fallback stacks. Replace each `var(--font-jakarta)` there with `system-ui`, then rerun and expect no matches.

- [ ] **Step 6: Typecheck, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/fonts.ts app/layout.tsx app/globals.css components/marketing/papel
git commit -m "feat(design): Archivo is the single face across the app"
```

### Task 3: Shared ornament module

**Files:**
- Create: `components/papel/guilloche.tsx` (moved), `components/papel/microprint.tsx` (moved), `components/papel/ornament.module.css`, `lib/papel/rosette.ts`, `lib/papel/rosette.test.ts`
- Delete: `components/marketing/papel/guilloche.tsx`, `components/marketing/papel/microprint.tsx`
- Modify: every importer (`rg -l "papel/guilloche|papel/microprint"`)

**Interfaces:**
- Produces `Guilloche({ variant?: "rosette" | "field"; className?; lineWidth?; duration? })` (unchanged API), `Microprint({ text, className? })` and `Serial({ value, className? })` (unchanged API), plus, in `lib/papel/rosette.ts` (no `"use client"`, so server components and next/og can call it): `type Rosette`, `ROSETTE_LAYERS`, `rosettePoints(r: Rosette): Float32Array` (moved out of `guilloche.tsx`, which now imports them) and the new `rosettePath(size: number, layers?: Rosette[]): string`, an SVG path `d` centred in a `size × size` box, used by the Seal.

- [ ] **Step 1: Move the files with git**

```bash
mkdir -p components/papel
git mv components/marketing/papel/guilloche.tsx components/papel/guilloche.tsx
git mv components/marketing/papel/microprint.tsx components/papel/microprint.tsx
```

- [ ] **Step 2: Move the microprint CSS**

Cut the rules `.microprint`, `.mpTop`, `.mpBottom`, `.mpLeft`, `.mpRight` and `.serial` (with any `@media` blocks that target only them) verbatim from `components/marketing/papel/papel.module.css` into the new `components/papel/ornament.module.css`. In `components/papel/microprint.tsx`, change `import s from "./papel.module.css";` to `import s from "./ornament.module.css";`.

- [ ] **Step 3: Fix the importers**

Run `rg -l "papel/guilloche|papel/microprint|\./guilloche|\./microprint" components app` and change each import to `@/components/papel/guilloche` or `@/components/papel/microprint`.

- [ ] **Step 4: Move the geometry and write the failing test**

Move `type Rosette`, `ROSETTE_LAYERS`, `gcd` and `rosettePoints` verbatim from `components/papel/guilloche.tsx` into a new `lib/papel/rosette.ts`, exporting `Rosette`, `ROSETTE_LAYERS` and `rosettePoints`. Then add `import { ROSETTE_LAYERS, rosettePoints, type Rosette } from "@/lib/papel/rosette";` to `guilloche.tsx`. The reason: a server component that imports a plain function from a `"use client"` module gets a client reference, not the function.

`lib/papel/rosette.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rosettePath } from "./rosette";

describe("rosettePath", () => {
  it("returns an SVG path that starts with a move and stays inside the box", () => {
    const d = rosettePath(64);
    expect(d.startsWith("M")).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.length).toBeGreaterThan(100);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(64);
    }
  });
  it("is deterministic", () => {
    expect(rosettePath(48)).toBe(rosettePath(48));
  });
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run lib/papel/rosette.test.ts`
Expected: FAIL. `rosettePath` is not exported.

- [ ] **Step 6: Implement `rosettePath` in `lib/papel/rosette.ts`**

Add it below `rosettePoints` and export it:

```ts
/** A static rosette as one SVG path, for places a canvas cannot go (the
 *  Seal, app icons rendered by next/og). Same curves as the live plate. */
export function rosettePath(size: number, layers: Rosette[] = ROSETTE_LAYERS): string {
  const extent = Math.max(...layers.map((l) => l.R - l.r + l.d));
  const scale = (size / 2 - 1) / extent;
  const c = size / 2;
  return layers
    .map((layer) => {
      const pts = rosettePoints(layer);
      let d = "";
      for (let i = 0; i < pts.length; i += 2) {
        const x = (c + pts[i] * scale).toFixed(2);
        const y = (c + pts[i + 1] * scale).toFixed(2);
        d += `${i === 0 ? "M" : "L"}${x} ${y}`;
      }
      return d + "Z";
    })
    .join("");
}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `npx vitest run lib/papel && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A components/papel components/marketing app lib/papel
git commit -m "refactor(design): guilloche and microprint shared under components/papel"
```

### Task 4: Stamp ink and the Stamp primitive (ColorTile becomes a Stamp)

**Files:**
- Create: `lib/papel/ink.ts`, `lib/papel/ink.test.ts`, `components/papel/stamp.tsx`
- Modify: `components/ui/color-tile.tsx` (delegates to Stamp, API unchanged)
- Modify: `app/globals.css` (`.stamp` rule)

**Interfaces:**
- Consumes: `toOklch`, `fromOklch`, `contrastRatio`, `HEX6` from `@/lib/color`.
- Produces `stampInk(hex: string, surface: string): string`, which returns `hex` itself when it already clears 3:1 against `surface`, and otherwise the nearest OKLCH-lightness shift that does. Also produces `STAMP_SURFACE = { light: "#eeebf5", dark: "#1d1829" }` (the binding surface per theme) and `Stamp({ color: string | null; emoji?; name?; icon?: LucideIcon; size?: "sm" | "md" | "lg"; className? })`.

- [ ] **Step 1: Write the failing test `lib/papel/ink.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { stampInk, STAMP_SURFACE } from "./ink";
import { contrastRatio } from "@/lib/color";
import { SWATCHES } from "@/lib/palette";

const HOSTILE = ["#ffffff", "#fafafa", "#eeebf5", "#000000", "#111111", "#1d1829", "#ffff00", "#7f7f7f"];

describe("stampInk", () => {
  it("clears 3:1 on the light paper for any hex", () => {
    for (const hex of [...HOSTILE, ...SWATCHES]) {
      expect(contrastRatio(stampInk(hex, STAMP_SURFACE.light), STAMP_SURFACE.light), hex).toBeGreaterThanOrEqual(3);
    }
  });
  it("clears 3:1 on the dark paper for any hex", () => {
    for (const hex of [...HOSTILE, ...SWATCHES]) {
      expect(contrastRatio(stampInk(hex, STAMP_SURFACE.dark), STAMP_SURFACE.dark), hex).toBeGreaterThanOrEqual(3);
    }
  });
  it("leaves a colour that already passes untouched", () => {
    expect(stampInk("#4a1f8c", STAMP_SURFACE.light)).toBe("#4a1f8c");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/papel/ink.test.ts`
Expected: FAIL. Cannot find module `./ink`.

- [ ] **Step 3: Implement `lib/papel/ink.ts`**

```ts
import { contrastRatio, fromOklch, relativeLuminance, toOklch } from "@/lib/color";

/** The surface each theme's stamps are measured against: the one of that
 *  theme's two papers that gives user ink the LEAST contrast. */
export const STAMP_SURFACE = { light: "#eeebf5", dark: "#1d1829" } as const;

/**
 * The ink a user colour prints in on a given paper. The hue and chroma are
 * the user's; only lightness walks toward contrast until the glyph clears
 * 3:1. A colour that already clears it is returned exactly as stored.
 */
export function stampInk(hex: string, surface: string): string {
  if (contrastRatio(hex, surface) >= 3) return hex;
  const towardDark = relativeLuminance(surface) > 0.18;
  const base = toOklch(hex);
  for (let step = 1; step <= 50; step++) {
    const l = Math.min(1, Math.max(0, base.l + (towardDark ? -0.02 : 0.02) * step));
    const out = fromOklch({ ...base, l });
    if (contrastRatio(out, surface) >= 3) return out;
  }
  return towardDark ? "#000000" : "#ffffff";
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/papel/ink.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `components/papel/stamp.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEX6 } from "@/lib/color";
import { stampInk, STAMP_SURFACE } from "@/lib/papel/ink";

const SIZES = {
  sm: { box: "size-9", glyph: "text-sm", icon: "size-[18px]" },
  md: { box: "size-11", glyph: "text-lg", icon: "size-5" },
  lg: { box: "size-14", glyph: "text-2xl", icon: "size-6" },
} as const;

/**
 * A category's or account's identity, printed as an ink stamp: a double ring
 * and the glyph in the user's own colour. The colour is data, so both theme
 * inks are computed from it (never assumed to be a shipped swatch) and the
 * CSS picks one per theme. Emoji keep their own colour inside the ring.
 */
export function Stamp({
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
  const valid = color && HEX6.test(color) ? color : null;
  const style = valid
    ? ({
        "--stamp-light": stampInk(valid, STAMP_SURFACE.light),
        "--stamp-dark": stampInk(valid, STAMP_SURFACE.dark),
      } as React.CSSProperties)
    : ({ "--stamp-light": "var(--ink-soft)", "--stamp-dark": "var(--ink-soft)" } as React.CSSProperties);
  return (
    <span
      aria-hidden
      style={style}
      className={cn("stamp flex shrink-0 items-center justify-center rounded-full font-bold", s.box, className)}
    >
      {emoji ? (
        <span className={s.glyph}>{emoji}</span>
      ) : Icon ? (
        <Icon className={s.icon} strokeWidth={2.25} />
      ) : name ? (
        <span className={cn(s.glyph, "[font-stretch:112%]")}>{name.charAt(0).toUpperCase()}</span>
      ) : null}
    </span>
  );
}
```

Callers also pass token colours such as `var(--success)` and `var(--chart-1)` (see `app/(app)/page.tsx`). Those are not hex, and shipped tokens already clear 3:1 on paper, so they pass through as-is. Replace the `style` constant above with the full three-way version:

```tsx
  const style = (
    valid
      ? { "--stamp-light": stampInk(valid, STAMP_SURFACE.light), "--stamp-dark": stampInk(valid, STAMP_SURFACE.dark) }
      : color?.startsWith("var(")
        ? { "--stamp-light": color, "--stamp-dark": color }
        : { "--stamp-light": "var(--ink-soft)", "--stamp-dark": "var(--ink-soft)" }
  ) as React.CSSProperties;
```

- [ ] **Step 6: Add the `.stamp` rule to `app/globals.css` (`@layer components`)**

```css
  /* Ink stamp: a double ring (outer rule + inner hairline) in the stamp's
     own ink. The ink per theme is computed in components/papel/stamp.tsx. */
  .stamp {
    color: var(--stamp-light);
    box-shadow:
      inset 0 0 0 1.5px currentColor,
      inset 0 0 0 3.5px var(--card),
      inset 0 0 0 4.25px currentColor;
  }
  .dark .stamp {
    color: var(--stamp-dark);
  }
```

- [ ] **Step 7: Make `ColorTile` delegate**

Replace the body of `components/ui/color-tile.tsx` with a re-export that keeps the name and props for every existing caller:

```tsx
/** Kept as an alias so existing callers restyle at once; removed in Phase 7. */
export { Stamp as ColorTile } from "@/components/papel/stamp";
```

- [ ] **Step 8: Remove the dead `.tile-sheen` utility**

Run: `rg -n "tile-sheen" --glob '!node_modules' --glob '!.next'`
Expected: only the definition in `app/globals.css`. Delete it.

- [ ] **Step 9: Test, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add lib/papel components/papel/stamp.tsx components/ui/color-tile.tsx app/globals.css
git commit -m "feat(design): categories and accounts print as ink stamps in the user's colour"
```

### Task 5: Note, LedgerRow, ProofMark, SpecimenFrame (HeroCard becomes a Note)

**Files:**
- Create: `components/papel/note.tsx`, `components/papel/ledger-row.tsx`, `components/papel/proof-mark.tsx`, `components/papel/specimen-frame.tsx`
- Modify: `components/ui/hero-card.tsx` (delegates to Note), `components/ui/stat-pill.tsx` (ProofMark styling), `messages/en.json` and `messages/es.json` (`Papel.specimen`)

**Interfaces:**
- Consumes: `Guilloche`, `Serial` from `@/components/papel/*`.
- Produces:
  - `Note({ tone?: "violet" | "peso"; label: string; serial?: string; action?: ReactNode; ornament?: boolean; className?; children })`
  - `LedgerRow({ lead?: ReactNode; title: ReactNode; subtitle?: ReactNode; amount?: ReactNode; meta?: ReactNode; className?; ...div props })`
  - `ProofMark({ tone: "ok" | "flag" | "neutral"; children: ReactNode; className? })`
  - `SpecimenFrame({ children; className? })` (label from `Papel.specimen`)

- [ ] **Step 1: Implement `components/papel/note.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { Guilloche } from "./guilloche";
import { Serial } from "./microprint";

/**
 * A screen's one banknote: the field the screen's main figure is printed on.
 * Violet or peso, never inverted by theme, never more than one per screen.
 * The line work is decoration (aria-hidden inside Guilloche); the label and
 * figure are the content.
 */
export function Note({
  tone = "violet",
  label,
  serial,
  action,
  ornament = true,
  className,
  children,
}: {
  tone?: "violet" | "peso";
  label: string;
  serial?: string;
  action?: React.ReactNode;
  ornament?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[6px] p-6 sm:p-7",
        tone === "violet" ? "bg-(--note) text-(--note-ink)" : "bg-(--peso) text-(--peso-ink)",
        className,
      )}
    >
      {ornament ? (
        <Guilloche
          variant="field"
          lineWidth={0.5}
          className="pointer-events-none absolute inset-0 -z-10 size-full opacity-25"
        />
      ) : null}
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[3px] border border-current opacity-30" />
      <p className="legend relative text-[11px] opacity-85">{label}</p>
      <div className="relative mt-2">{children}</div>
      {action ? <div className="relative mt-6 flex flex-wrap gap-3">{action}</div> : null}
      {serial ? <Serial value={serial} className="absolute right-4 top-3" /> : null}
    </section>
  );
}
```

- [ ] **Step 2: Make `HeroCard` a Note**

Replace the body of `components/ui/hero-card.tsx`:

```tsx
import { Note } from "@/components/papel/note";

/** Alias kept so existing callers become a violet note at once; removed in Phase 7. */
export function HeroCard(props: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return <Note tone="violet" {...props} />;
}
```

- [ ] **Step 3: Implement `components/papel/ledger-row.tsx`**

```tsx
import { cn } from "@/lib/utils";

/**
 * One printed ledger line: lead (a Stamp or date), title/subtitle, and a
 * right-aligned tabular amount. The rule under it is the separator; a list
 * of these needs no card around each row.
 */
export function LedgerRow({
  lead,
  title,
  subtitle,
  amount,
  meta,
  className,
  ...props
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  meta?: React.ReactNode;
} & Omit<React.ComponentProps<"div">, "title">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-3 border-b border-(--paper-line) px-4 py-3 last:border-b-0", className)}
      {...props}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {amount || meta ? (
        <div className="figure shrink-0 text-right">
          {amount}
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/papel/proof-mark.tsx`**

```tsx
import { cn } from "@/lib/utils";

const GLYPH = {
  ok: <path d="M3.5 8.2 6.6 11 12.5 4.8" />,
  flag: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  neutral: <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />,
} as const;

/**
 * A printed verification mark: glyph in an ink ring + a label. The glyph
 * carries the state, so it never depends on colour alone (teal/red only
 * reinforce it).
 */
export function ProofMark({
  tone,
  children,
  className,
}: {
  tone: keyof typeof GLYPH;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        tone === "ok" && "text-(--teal)",
        tone === "flag" && "text-(--red)",
        tone === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <circle cx="8" cy="8" r="7.1" strokeWidth={1.1} />
        {GLYPH[tone]}
      </svg>
      <span>{children}</span>
    </span>
  );
}
```

- [ ] **Step 5: Restyle `StatPill`**

Open `components/ui/stat-pill.tsx`. Keep its props, but render `ProofMark`: map `tone="destructive"` to `flag`, `tone="success"` (if present) to `ok`, and everything else to `neutral`, passing `children` through. Remove the pill background classes.

- [ ] **Step 6: Implement `components/papel/specimen-frame.tsx` and its copy**

Add `"Papel": { "specimen": "Ejemplo · Specimen" }` to `messages/en.json` and `"Papel": { "specimen": "Ejemplo · Muestra" }` to `messages/es.json`. This microprint copy stays Spanish-led in both, per the spec.

```tsx
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Frames illustrative UI (help mocks, empty-state previews) so a specimen
 *  can never be mistaken for the user's real figures. */
export function SpecimenFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("Papel");
  return (
    <figure className={cn("relative rounded-[4px] border border-dashed border-(--ink-soft) p-3 pt-6", className)}>
      <figcaption className="legend absolute left-3 top-1.5 text-[9px] text-muted-foreground">{t("specimen")}</figcaption>
      {children}
    </figure>
  );
}
```

- [ ] **Step 7: Check message parity, then typecheck and lint**

Run: `node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const a=new Set(f(require('./messages/en.json'))),b=new Set(f(require('./messages/es.json')));const d=[...a].filter(k=>!b.has(k)).concat([...b].filter(k=>!a.has(k)));console.log(d.length?d:'parity ok')" && npx tsc --noEmit && npm run lint`
Expected: `parity ok`, no type errors, lint clean.

- [ ] **Step 8: Commit**

```bash
git add components/papel components/ui/hero-card.tsx components/ui/stat-pill.tsx messages
git commit -m "feat(design): Note, ledger row, proof mark and specimen frame primitives"
```

### Task 6: Perforation and RuleMeter (Progress becomes a RuleMeter)

**Files:**
- Create: `lib/papel/perforation.ts`, `lib/papel/perforation.test.ts`, `lib/papel/meter.ts`, `lib/papel/meter.test.ts`, `components/papel/perforation.tsx`, `components/papel/rule-meter.tsx`
- Modify: `components/ui/progress.tsx`

**Interfaces:**
- Produces:
  - `perforationCells(total: number, paid: number, max = 24): { cells: { index: number; paid: boolean }[]; hidden: number }`
  - `meterFill(used: number, total: number): { pct: number; over: boolean }`, with `pct` clamped to 0..100
  - `Perforation({ total; paid; label: string; className? })`
  - `RuleMeter({ used; total; label: string; className? })`

- [ ] **Step 1: Write the failing tests**

`lib/papel/perforation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { perforationCells } from "./perforation";

describe("perforationCells", () => {
  it("marks the first `paid` cells as punched", () => {
    const { cells, hidden } = perforationCells(6, 2);
    expect(cells.map((c) => c.paid)).toEqual([true, true, false, false, false, false]);
    expect(hidden).toBe(0);
  });
  it("clamps paid into 0..total", () => {
    expect(perforationCells(3, 9).cells.every((c) => c.paid)).toBe(true);
    expect(perforationCells(3, -1).cells.some((c) => c.paid)).toBe(false);
  });
  it("caps the drawn cells and reports the rest", () => {
    const { cells, hidden } = perforationCells(48, 10, 24);
    expect(cells).toHaveLength(24);
    expect(hidden).toBe(24);
  });
  it("returns nothing for a zero or invalid total", () => {
    expect(perforationCells(0, 0).cells).toEqual([]);
    expect(perforationCells(Number.NaN, 1).cells).toEqual([]);
  });
});
```

`lib/papel/meter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { meterFill } from "./meter";

describe("meterFill", () => {
  it("is a clamped percentage", () => {
    expect(meterFill(25, 100)).toEqual({ pct: 25, over: false });
    expect(meterFill(150, 100)).toEqual({ pct: 100, over: true });
    expect(meterFill(-5, 100)).toEqual({ pct: 0, over: false });
  });
  it("treats a zero budget as empty, not over", () => {
    expect(meterFill(10, 0)).toEqual({ pct: 0, over: false });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run lib/papel`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement both helpers**

`lib/papel/perforation.ts`:

```ts
export function perforationCells(total: number, paid: number, max = 24) {
  if (!Number.isFinite(total) || total <= 0) return { cells: [], hidden: 0 };
  const n = Math.floor(total);
  const p = Math.min(Math.max(Math.floor(paid) || 0, 0), n);
  const drawn = Math.min(n, max);
  return {
    cells: Array.from({ length: drawn }, (_, index) => ({ index, paid: index < p })),
    hidden: n - drawn,
  };
}
```

`lib/papel/meter.ts`:

```ts
export function meterFill(used: number, total: number) {
  if (!(total > 0)) return { pct: 0, over: false };
  const raw = (used / total) * 100;
  return { pct: Math.min(Math.max(raw, 0), 100), over: raw > 100 };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/papel`
Expected: PASS.

- [ ] **Step 5: Implement the components**

`components/papel/perforation.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { perforationCells } from "@/lib/papel/perforation";

/** Cuotas as a perforated strip: paid cells print solid ink, unpaid ones
 *  are outlined. `label` is the accessible reading ("3 de 12 cuotas"). */
export function Perforation({ total, paid, label, className }: { total: number; paid: number; label: string; className?: string }) {
  const { cells, hidden } = perforationCells(total, paid);
  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap items-center gap-1", className)}>
      {cells.map((c) => (
        <i
          key={c.index}
          className={cn(
            "h-3 w-2.5 rounded-[1px] border border-current",
            c.paid ? "bg-current" : "border-dashed opacity-60",
          )}
        />
      ))}
      {hidden > 0 ? <span className="figure ml-1 text-xs text-muted-foreground">+{hidden}</span> : null}
    </div>
  );
}
```

`components/papel/rule-meter.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { meterFill } from "@/lib/papel/meter";

/** A ruled scale filled with ink. Over budget prints a double rule at the
 *  end and a red fill, so the state never relies on colour alone. */
export function RuleMeter({ used, total, label, className }: { used: number; total: number; label: string; className?: string }) {
  const { pct, over } = meterFill(used, total);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-2 border-b border-(--rule)", className)}
      style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--paper-line) 0 1px, transparent 1px 10%)" }}
    >
      <div
        className={cn("bar-fill absolute inset-y-0 left-0", over ? "bg-(--red)" : "bg-foreground")}
        style={{ width: `${pct}%` }}
      />
      {over ? <span aria-hidden className="absolute -right-1 inset-y-[-3px] w-[3px] border-x border-(--red)" /> : null}
    </div>
  );
}
```

- [ ] **Step 6: Restyle `components/ui/progress.tsx`**

Keep the base-ui Progress structure and props. Change the track classes to `h-2 rounded-none border-b border-(--rule) bg-transparent` with the same `repeating-linear-gradient` background as RuleMeter, and change the indicator to `rounded-none bg-foreground`.

- [ ] **Step 7: Test and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/papel components/papel components/ui/progress.tsx
git commit -m "feat(design): perforated cuota strip and ruled meter"
```

### Task 7: shadcn primitives reskinned as paper

**Files:**
- Modify: `components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `switch.tsx`, `badge.tsx`, `sonner.tsx`
- Modify: `app/globals.css` (`.perforated-top` utility)

**Interfaces:**
- Every export name, prop and variant name stays the same. Only classes change.

- [ ] **Step 1: Button (`components/ui/button.tsx`)**

In the base string, replace `rounded-xl` with `rounded-[4px]`, add `font-semibold`, and replace `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` with `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`. Replace the variants:

```ts
        default: "bg-primary text-primary-foreground hover:bg-(--note-deep)",
        outline:
          "border-foreground bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-(--secondary-hover) aria-expanded:bg-secondary",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "border-(--red) bg-transparent text-(--red) hover:bg-(--red) hover:text-white",
        link: "text-brand underline underline-offset-4 decoration-1 hover:decoration-2",
        brand:
          "rounded-full bg-(--note) text-(--note-ink) shadow-(--shadow-float) hover:bg-(--note-deep)",
```

In the sizes, replace every `rounded-lg` with `rounded-[3px]`.

- [ ] **Step 2: Inputs (`input.tsx`, `textarea.tsx`)**

Make each field a baseline rule, the same way `components/auth/login-form.tsx` draws them. Replace the border and radius classes with `rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none focus-visible:border-foreground focus-visible:border-b-2 focus-visible:ring-0`, and keep `aria-invalid:border-destructive`. The textarea keeps a full hairline box (`rounded-[3px] border border-input`), because multi-line text needs the frame.

- [ ] **Step 3: Card (`card.tsx`), which is now the "Sheet"**

Replace `rounded-2xl` with `rounded-[4px]` everywhere in the file, including `rounded-t-2xl`, `rounded-b-2xl` and the img radii. Replace `shadow-(--shadow-card)` with `border border-(--paper-line) shadow-none`. In `CardFooter`, replace `bg-muted/50` with `bg-transparent` and make its top border `border-(--paper-line)`. Rewrite the file's comment: a sheet of paper framed by a hairline, with no elevation.

- [ ] **Step 4: Add the perforated-top utility to `app/globals.css` (`@layer components`)**

```css
  /* A slip torn from a pad: a row of punched holes along the top edge.
     Pure CSS mask; no raster. */
  .perforated-top {
    --hole: 5px;
    mask:
      radial-gradient(circle at 50% 0, transparent calc(var(--hole) / 2), #000 calc(var(--hole) / 2 + 0.5px)) top / 14px 8px repeat-x,
      linear-gradient(#000, #000) 0 8px / 100% calc(100% - 8px) no-repeat;
  }
```

- [ ] **Step 5: Dialog, Select, Dropdown**

- `dialog.tsx`: on the popup, replace its radius and shadow classes with `perforated-top rounded-[4px] border border-(--paper-line) bg-popover pt-6`, and give the overlay `bg-(--ink)/40` with no blur.
- `select.tsx`, `dropdown-menu.tsx`: popups get `rounded-[3px] border border-(--paper-line) shadow-[0_8px_24px_-12px_rgb(27_21_48/0.35)]`. Items get `rounded-none border-b border-(--paper-line) last:border-b-0`, and the highlighted item gets `bg-accent font-semibold`.

- [ ] **Step 6: Tabs, Switch, Badge, Sonner**

- `tabs.tsx`: the list becomes `bg-transparent border-b border-(--paper-line) rounded-none p-0`. The trigger is `rounded-none border-b-2 border-transparent data-[active]:border-foreground data-[active]:font-semibold`. Use whatever active attribute the file already styles.
- `switch.tsx`: keep the shape (a round toggle is a familiar affordance), but set the track checked colour to `bg-primary` and unchecked to `bg-(--paper-line)`.
- `badge.tsx`: `rounded-[3px] border border-current bg-transparent` for every variant, and keep each variant's text colour.
- `sonner.tsx`: pass `toastOptions={{ classNames: { toast: "perforated-top rounded-[4px] border border-(--paper-line) bg-popover pt-5 font-sans" } }}`, merged with whatever it already passes.

- [ ] **Step 7: Typecheck, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add components/ui app/globals.css
git commit -m "feat(design): shadcn primitives reprinted as paper, rules and slips"
```

### Task 8: The engraved Seal (logo, app icons, OG, FAB)

**Files:**
- Create: `components/papel/seal.tsx`
- Modify: `components/brand/logo.tsx`, `lib/pwa/icon.tsx`, `app/manifest.ts` (`theme_color` / `background_color`), `app/manifest.test.ts` (if it asserts colours), `components/quick-add/quick-add-button.tsx`

**Interfaces:**
- Consumes: `rosettePath` (Task 3).
- Produces `Seal({ className?, tone?: "note" | "ink" })`, a round engraved mark: rosette ring plus the Coins glyph in intaglio line, drawn in `currentColor` over a note-violet disc. `Logo` keeps its name and props and renders `Seal`.

- [ ] **Step 1: Implement `components/papel/seal.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { rosettePath } from "@/lib/papel/rosette";

const RING = rosettePath(64);

/**
 * The Cashly seal: the engraved re-issue of the logo. A guilloche rosette
 * ring cut around the incumbent Coins mark, all line work, in note ink on a
 * note-violet disc. Static SVG (no canvas) so next/og can render it too.
 */
export function Seal({ className, tone = "note" }: { className?: string; tone?: "note" | "ink" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full",
        tone === "note" ? "bg-(--note) text-(--note-ink)" : "text-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-full" fill="none" stroke="currentColor">
        <path d={RING} strokeWidth={0.35} opacity={0.55} />
        <circle cx="32" cy="32" r="30.5" strokeWidth={1.2} />
        <circle cx="32" cy="32" r="17" strokeWidth={0.8} />
        {/* Coins, redrawn in the 64 box (lucide 'coins' geometry, scaled and centred). */}
        <g transform="translate(20 20)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </g>
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Re-point `Logo`**

In `components/brand/logo.tsx`, replace the `Logo` body with `return <Seal className={cn("size-8", className)} />;`, import `Seal`, and drop the `Coins` import. In `Wordmark`, change the classes to `legend text-base text-foreground` (the expanded engraved caps) in place of `font-semibold tracking-tight`.

- [ ] **Step 3: App icons**

Open `lib/pwa/icon.tsx`. Wherever it paints `var(--hero)` or a gradient, paint a flat `#4a1f8c` disc and inline the same SVG as `Seal`, with `stroke="#f8f5ff"` and the path from `rosettePath(64)` (imported from `@/lib/papel/rosette`). next/og cannot read CSS variables, so the hex values are literal here. Set `theme_color` and `background_color` in `app/manifest.ts` to `#eeebf5`. If `app/manifest.test.ts` asserts the old values, update the expectations to `#eeebf5`.

- [ ] **Step 4: The FAB seal**

In `components/quick-add/quick-add-button.tsx`, keep `variant="brand"` (now the note-violet disc from Task 7). Replace the comment with one line: "The one violet seal on the shell: quick-add is the signature action." Add `ring-2 ring-(--note-line) ring-offset-2 ring-offset-background` for the engraved double edge.

- [ ] **Step 5: Test, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/papel/seal.tsx components/brand/logo.tsx lib/pwa app/manifest.ts app/manifest.test.ts components/quick-add/quick-add-button.tsx
git commit -m "feat(brand): the Cashly mark re-engraved as a seal"
```

### Task 9: Shell — sidebar, header, bottom band, splash

**Files:**
- Modify: `components/shell/nav-link.tsx:18-100`, `sidebar.tsx`, `mobile-header.tsx`, `bottom-nav.tsx`, `activity-sheet.tsx`, `splash.tsx`, `app-shell.tsx` (padding comment only if values change), `lib/pwa/theme-color.ts`

**Interfaces:**
- `navItemClass(variant, active)` and `NavItemBody` keep their signatures.
- `TOPBAR_LIGHT` becomes `#eeebf5` and `TOPBAR_DARK` becomes `#15111f`.

- [ ] **Step 1: Nav state as ink density (`nav-link.tsx`)**

Replace `navItemClass` with:

```ts
export function navItemClass(variant: "side" | "bottom", active: boolean) {
  return cn(
    "group relative flex items-center gap-3 text-sm transition-colors",
    variant === "side" && "rise px-3 py-2",
    variant === "bottom" && "min-w-0 flex-col gap-1 px-0.5 pb-1.5 pt-2 text-xs",
    // Ink density is the state: active prints in full ink and weight,
    // inactive recedes to underprint. The rule (below) is the second cue.
    active ? "font-semibold text-foreground" : "font-normal text-muted-foreground hover:text-foreground",
    variant === "side" &&
      active &&
      "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:bg-foreground",
  );
}
```

In `NavItemBody`, delete the filled `bg-sidebar-primary` pill span, the `bottom && active && "text-sidebar-primary-foreground"` class and the `group-hover:scale-110` transform. For the bottom variant, add a top rule above the active icon: `bottom && active && "before:absolute before:-top-2 before:inset-x-3 before:h-[3px] before:bg-foreground"`. Keep `font-semibold` on the active label. Update the comments to describe the ink-density rule.

- [ ] **Step 2: Sidebar (`sidebar.tsx`)**

- `aside`: `md:border-r md:border-(--rule) md:bg-sidebar`.
- Brand row: `<Logo className="size-9" />` beside `<Wordmark />`, plus an `aria-hidden` vertical microprint strip down the right edge: `<Microprint text="CASHLY · REPÚBLICA DOMINICANA · " className="…" />` is too heavy for a strip, so render a single rotated `span` with `legend text-[7px] tracking-[0.3em] text-muted-foreground [writing-mode:vertical-rl]` repeating the same text, `absolute right-1 inset-y-6 overflow-hidden`, and give the aside `relative`.
- Account row avatar fallback: `bg-transparent text-foreground ring-1 ring-(--rule)` in place of `bg-brand/15 text-brand`.

- [ ] **Step 3: Mobile header (`mobile-header.tsx`)**

Header classes: `sticky top-0 z-30 flex h-14 items-center justify-between border-b border-(--rule) bg-background px-4 md:hidden`. Remove `backdrop-blur` and `/95`. Use `<Logo className="size-7" />`.

- [ ] **Step 4: Bottom band (`bottom-nav.tsx`)**

The floating capsule becomes a ruled paper band on the safe area:

```tsx
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid items-center border-t border-(--rule) bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${MOBILE_NAV_ITEMS.length}, minmax(0, 1fr))` }}
    >
```

Rewrite the long comment above it for the band: equal columns (keep that rationale), and the inset is now interior padding because the band sits on the screen edge.

- [ ] **Step 5: Recheck FAB clearance in `app-shell.tsx`**

The band's top edge now sits at 56px plus the inset, lower than the capsule's 72px plus the inset. The FAB (bottom offset 5rem, size 60px) still tops out at 140px plus the inset, so the existing `9.5rem + inset` main padding still clears it. Update the comment's arithmetic to describe the band (56 + inset) and leave the value alone.

- [ ] **Step 6: Activity sheet (`activity-sheet.tsx`)**

Give the sheet popup `perforated-top rounded-t-[4px] border-t border-(--rule) bg-popover pt-6`, and render its items as `LedgerRow` (title = label, lead = the item icon at `size-5`).

- [ ] **Step 7: Splash (`splash.tsx`)**

Replace the centred `Logo` + `Wordmark` with a note-violet full-screen field: the container gets `bg-(--note) text-(--note-ink)` in place of `bg-background`. Inside it, add `<Guilloche variant="rosette" className="absolute left-1/2 top-1/2 size-[min(80vw,28rem)] -translate-x-1/2 -translate-y-1/2 opacity-40" duration={700} />`, then `<Seal className="size-14" />` and `<span className="legend text-xl">Cashly</span>` stacked. Keep `HOLD_MS`, the skip script and the reduced-motion behaviour (Guilloche already draws the final frame under reduced motion).

- [ ] **Step 8: Theme colours (`lib/pwa/theme-color.ts`)**

```ts
/** Matches components/shell/mobile-header.tsx's `bg-background` in each theme. */
export const TOPBAR_LIGHT = "#eeebf5";
export const TOPBAR_DARK = "#15111f";
```

- [ ] **Step 9: Test, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. Update `lib/nav.test.ts` only if it asserts class strings.

- [ ] **Step 10: Commit**

```bash
git add components/shell lib/pwa/theme-color.ts
git commit -m "feat(shell): paper shell with ink-density navigation and a note splash"
```

### Task 10: The stamp sound replaces the success chime

**Files:**
- Modify: `scripts/generate-sounds.mjs`, `scripts/generate-sounds.test.ts`, `components/sound/sound-provider.tsx`
- Create (generated): `public/sounds/stamp.wav`
- Delete: `public/sounds/success.wav`

**Interfaces:**
- `useUiSound().playSuccess` keeps its name and callers. Only the file it plays changes, to `/sounds/stamp.wav`.

- [ ] **Step 1: Write the failing test**

In `scripts/generate-sounds.test.ts`, change `SOUND_FILES` to `["stamp.wav", "delete.wav", "error.wav"]` and replace the `success.wav rings long enough` test with:

```ts
test("public/sounds/stamp.wav is a short percussive stamp, not a chime", () => {
  const buffer = readFileSync(join(process.cwd(), "public/sounds", "stamp.wav"));
  const samples: number[] = [];
  for (let i = 44; i + 1 < buffer.length; i += 2) samples.push(Math.abs(buffer.readInt16LE(i) / 32767));
  const durationMs = (samples.length / 44100) * 1000;
  expect(durationMs).toBeLessThan(400);
  const peakAt = samples.indexOf(Math.max(...samples));
  expect((peakAt / 44100) * 1000).toBeLessThan(30); // the hit lands immediately
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: FAIL. `stamp.wav` does not exist.

- [ ] **Step 3: Synthesise the stamp in `scripts/generate-sounds.mjs`**

Add a seeded PRNG so the file is reproducible, and a stamp voice: a low body thump plus a short band of paper noise. Replace the `success` block and its write line.

```js
/* Deterministic noise so regenerating the file is byte-stable. */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Stamp: a rubber stamp meeting paper. A pitched-down body thump (the block
   landing) and a 25ms burst of low-passed noise (the paper), both starting on
   the first millisecond, gone by 0.28s. Replaces the old E5→B5 chime as the
   success cue: in a world printed on paper, "done" is a stamp. */
function stamp() {
  const duration = 0.28;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = mulberry32(417);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 150 - 70 * Math.min(1, t / 0.05);
    const body = Math.sin(2 * Math.PI * f * t) * Math.exp(-28 * t);
    lp += 0.18 * ((rand() * 2 - 1) - lp);
    const paper = lp * Math.exp(-160 * t) * 2.2;
    const attack = t < ATTACK ? 0.5 * (1 - Math.cos((Math.PI * t) / ATTACK)) : 1;
    const tail = Math.max(0, Math.min(1, (duration - t) / TAIL));
    out[i] = (0.62 * body + 0.38 * paper) * attack * tail * 0.9;
  }
  return out;
}

writeWavFile(join(OUT_DIR, "stamp.wav"), stamp());
```

Update the final log line to `Generated public/sounds/{stamp,delete,error}.wav`.

- [ ] **Step 4: Regenerate and remove the chime**

```bash
node scripts/generate-sounds.mjs && git rm public/sounds/success.wav
```

- [ ] **Step 5: Point the provider at the stamp**

In `components/sound/sound-provider.tsx`, change `useSound("/sounds/success.wav", …)` to `useSound("/sounds/stamp.wav", { volume: 0.6 })`. Check the PWA precache list for the old path: `rg -n "success.wav" --glob '!node_modules' --glob '!.next'`. Every hit (a service worker or manifest) changes to `stamp.wav`, and after that there should be no hits.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts public/sounds components/sound
git commit -m "feat(sound): a paper stamp replaces the success chime"
```

### Task 11: Phase 0 review, help check, DESIGN.md and merge

**Files:**
- Modify: `DESIGN.md` (via the impeccable documenter), `app/(app)/help/page.tsx` and `components/help/mocks.tsx` only where the review finds a mismatch, `messages/{en,es}.json` (Help copy that names old visuals)

- [ ] **Step 1: Help copy audit**

Run: `rg -n -i "violet card|gradient|pill|bubble|tile" messages/en.json messages/es.json components/help`
Expected: a list of every help string that describes the old look. Rewrite each to match the new UI (for example "the violet note at the top") in en and es together, then run the parity check from Task 5 Step 7.

- [ ] **Step 2: Batched visual review (ask the user first)**

Ask the user before starting the dev server. With consent, check for an existing server (`ss -ltnp | grep 3000`), run `NODE_OPTIONS=--max-old-space-size=6144 npx next dev -p 3000` with `run_in_background`, and capture the following with `agent-browser` in a named session: `/`, `/accounts`, `/transactions`, `/budgets`, `/insights`, `/settings`, `/help` and `/welcome`, at 1440×900 and 360×780, in light and dark, with the locale set to es. Save the captures to `.impeccable/review/phase0-<route>-<w>-<theme>.png`. Check specifically:
- Archivo tabular figures at 11–12px in the transactions ledger. If digits misalign, record it as a blocking finding.
- Stamps for a near-white and a near-black user colour.
- No horizontal scroll at 360px.
- Nothing hidden behind the bottom band or FAB.

Fix everything found in one batch, recapture once, then stop the server and `agent-browser close`, and confirm with `pgrep -af "next dev"`.

- [ ] **Step 3: Detector, finish reviewer, documenter**

Run: `node .claude/skills/impeccable/scripts/detect.mjs --json components/papel components/ui components/shell app/globals.css`
Fix what is mechanical. Then spawn `impeccable-finish-reviewer` fresh, giving it: the spec path, this task list, the screenshot paths, the detector output and `.claude/skills/impeccable/reference/craft-floor.md`. Act on its disposition (ship / fix / recapture / rebuild) per `reference/new-work.md` §7, with at most two rounds. Then spawn `impeccable-documenter` to rewrite `DESIGN.md`. Its scope is now the whole domain; it adds the primitive table from the spec §3 and the Resolved decisions, and drops "the signed-in app keeps its own system".

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all pass, and the build succeeds.

- [ ] **Step 5: Commit, merge and delete the branch**

```bash
git add -A DESIGN.md messages components app
git commit -m "docs(design): DESIGN.md covers the whole domain after Papel foundation"
git checkout main && git merge --no-ff redesign/papel-foundation
git branch -d redesign/papel-foundation && git push origin --delete redesign/papel-foundation 2>/dev/null; git push origin main
git --no-pager log --oneline -3
```

Expected: the merge commit is at the top of `main`.

---

# Phases 1–6 — Screen families

Every screen phase has the same shape, and each is its own branch (`redesign/papel-<family>`). Phase 0's primitives are the only building blocks allowed. A new primitive needs a DESIGN.md change approved by the user. The **composition** of each screen comes from an impeccable comp round, not from this plan. That is the contract of the project's comp-led build path (`.impeccable/config.json` → `buildPath: "comp"`), so each phase starts with a short phase plan written after its comp is approved and saved as `docs/superpowers/plans/2026-09-19-papel-<family>.md`. What this plan fixes for each phase is its scope, its files, its non-negotiables and its acceptance checks.

**Common steps (every phase):**
1. Create the branch.
2. `/impeccable shape <family>` against the spec §5–6: confirm states and tasks in one question round.
3. Only for Phases 1, 2 and 5 (open composition), run `node .claude/skills/impeccable/scripts/concept-seed.mjs --scope surface --mode operate`. Serve the decision page, generate comps anchored on a screenshot of the Papel home page plus DESIGN.md, and have the user lock one.
4. Write the phase plan (superpowers:writing-plans) from the locked comp, then build it TDD-first for any logic touched.
5. Help guide: update `app/(app)/help/page.tsx`, `components/help/mocks.tsx` (mocks wrapped in `SpecimenFrame`, built from the same primitives) and the en + es copy for the screens in this phase.
6. Batched review as in Task 11 Step 2 (desktop + 360px, light + dark, es), one fix batch, then the detector, `impeccable-finish-reviewer`, and `impeccable-documenter` (extending DESIGN.md).
7. `/impeccable audit <routes>` then `/impeccable polish <routes>`.
8. `npx tsc --noEmit && npm run lint && npm test && npm run build`, parity check, merge, and delete the branch.

### Task 12: Phase 1 — Overview (`redesign/papel-overview`)

**Files:** `app/(app)/page.tsx`, `components/overview/{available-hero,import-callout,recommendation-card,ask-entry}.tsx`, `components/statements/import-button.tsx` (styling only), help Overview chapter + mocks.

**Non-negotiables:**
- The Disponible figure is a **peso** `Note` (`tone="peso"`) with the figure in expanded denomination numerals (`MoneyDisplay size="hero"` plus `[font-stretch:125%] font-extrabold`) and a quincena timeline engraved on its bottom edge (period start → today → payday, from `a.periodEnd` and the existing period data).
- Its serial encodes the period: `QNA <yyyy>-<mm> <A|B>` (A for the first quincena, B for the second), and it is `aria-hidden`.
- Net worth stays visible on the same note at every width. The breakdown disclosure keeps its current mobile collapse behaviour and ARIA.
- A negative Disponible prints in `--red` ink on a white inset panel inside the note, because red on orange fails contrast, plus a flag ProofMark.
- "Este período": three figures as one ruled table (`Card` + `LedgerRow`s, or a 3-column ruled grid on sm+), not three cards. Budget uses `RuleMeter`.
- Coach recommendation as a margin note: a left-ruled block, no card. Ask is a single baseline-rule input. Upcoming uses `LedgerRow` with the date as `meta`.
- The empty state (no accounts) puts statement import first: the violet `Note` carries the import action, and the three starter links become `LedgerRow` links.

**Acceptance:** at most one Note on the page. An eight-digit figure plus `RD$` fits 360px without wrapping. FX-degraded notice sits directly under the note. Figure-mask keeps widths.

### Task 13: Phase 2 — Accounts and the shared card face (`redesign/papel-accounts`)

**Files:** create `components/papel/card-face.tsx`. Modify `components/accounts/{payment-card,card-group-tile,account-card,account-gallery,card-line-rail,card-report,statements-panel,amortization-table,balance-chart,account-activity,account-detail-actions,account-form-dialog}.tsx`, `app/(app)/accounts/{page,[id]/page}.tsx`, `components/marketing/marketing-home.tsx` (cards section) and `components/marketing/papel/papel.module.css` (`.card*` rules move out), the onboarding card step, and the help Accounts chapter + mocks.

**The card face (resolved decision 2):** there is one component, used by the home page and every in-app card, so they match by construction. Its anatomy is exactly the homepage face (`papel.module.css:1009-1063`): 1.7 aspect ratio, 18px radius, a 135° two-stop fill, a clipped guilloche rosette at 0.35 opacity in `currentColor`, the name in Archivo 112% / 800, the number with 0.14em tracking, the network as an italic expanded wordmark bottom-right, and the inset top highlight plus deep drop shadow. The fill comes from the card's stored accent via the existing `gradientFrom`/`cardForeground` in `lib/color.ts`, so brand-colour inference (the positioning claim) is kept. Nothing the homepage face lacks is added. The in-app `CornerDots` and brand `NetworkMark` logos are dropped in favour of the homepage's wordmark treatment.

```tsx
// components/papel/card-face.tsx
import { Guilloche } from "./guilloche";
import { cardForeground, gradientFrom } from "@/lib/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@/lib/accounts/card-art";
import { cn } from "@/lib/utils";

export const NETWORK_WORDMARK: Record<string, string> = {
  visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX", discover: "DISCOVER",
};

/** The one card face: the homepage's drawn card, fed by the stored accent. */
export function CardFace({
  name, last4, network, accent, className,
}: {
  name: string; last4: string | null; network: string | null; accent: string | null; className?: string;
}) {
  const base = accent && HEX6.test(accent) ? accent : DEFAULT_CARD_ACCENT;
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[1.7] w-full max-w-[25rem] flex-col justify-between overflow-hidden rounded-[18px] px-[1.4rem] py-[1.3rem]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_26px_50px_-24px_rgb(20_10_40/0.7)]",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${base}, ${gradientFrom(base)})`, color: cardForeground(base) }}
    >
      <Guilloche lineWidth={0.5} className="absolute -right-[95%] -top-[75%] -z-10 aspect-square w-[150%] opacity-35" />
      <span className="text-[1.1rem] font-extrabold [font-stretch:112%]">{name}</span>
      <span className="figure font-semibold tracking-[0.14em]">•••• {last4 ?? "····"}</span>
      {network ? (
        <span className="absolute bottom-[1.2rem] right-[1.4rem] text-[0.95rem] font-black italic tracking-[0.04em] [font-stretch:125%]">
          {NETWORK_WORDMARK[network] ?? network.toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}
```

Check `gradientFrom`'s and `cardForeground`'s real signatures in `lib/color.ts` before use; if they take options, match them. The home page's Visa Oro and Mastercard Black specimens become `<CardFace accent="#e4b64a" …>` and `<CardFace accent="#2a2733" …>`, keeping their rotation/offset classes in `papel.module.css`, and the `.card`, `.cardGold`, `.cardBlack`, `.cardRosette`, `.cardName`, `.cardNumber` and `.cardNet` rules are deleted. Write a test `components/papel/card-face.test.tsx` that asserts the network wordmark mapping, the invalid-accent fallback to `DEFAULT_CARD_ACCENT`, and that the home page renders `CardFace` (`rg "CardFace" components/marketing/marketing-home.tsx`).

**Other non-negotiables:**
- Net worth is the violet `Note`.
- Per-currency card lines are ledger sections under a double rule.
- Cuotas and loans use `Perforation`.
- The statements panel is a `LedgerRow` list with a `ProofMark` (`ok` = the statement's sums checked, `flag` = they did not), driven by the existing import status fields.
- The amortisation table is a ruled ledger.
- The balance chart is an ink line on hairline axes (Phase 5 finalises chart style, and Phase 2 must not contradict it).

**Acceptance:** home page cards and in-app cards are pixel-identical for the same accent (compare side by side at the same width). A near-white and a near-black accent are both legible.

### Task 14: Phase 3 — Transactions and Imports (`redesign/papel-ledger`)

**Files:** `components/transactions/{ledger,transaction-row,category-rail,transaction-form,transaction-dialog,account-date-line,fee-summary-line}.tsx`, `app/(app)/transactions/page.tsx`, `components/quick-add/*` (dialog), `components/statements/statement-import-dialog.tsx` and its steps, `components/imports/triage-list.tsx`, `app/(app)/imports/[id]/page.tsx`, help chapters + mocks.

**Non-negotiables:**
- There is **no Note** on these screens.
- The ledger is `LedgerRow`s under sticky date rules (a `legend` date plus a full-width rule), with the stamp as lead and the tabular amount. Income prints in `--teal` with a leading `+`, and expenses in ink with `−`. The sign carries the state, not the colour.
- The category rail is a horizontal strip of Stamps.
- The form and quick-add are paper slips (`perforated-top`) with baseline inputs.
- The import dialog shows the statement being read as a ruled sheet that fills row by row, reusing the marketing `statement-specimen` motion grammar with real rows and no specimen data.
- In triage, merchant groups are ledger blocks with one stamp picker each. Finishing triage stamps a large `ProofMark ok` across the sheet (one-shot, reduced-motion safe) and plays the stamp sound through the existing `playSuccess`.
- Density: at least 9 rows visible at 360×780.

**Acceptance:** a 60-character merchant name truncates cleanly. A two-currency row aligns. Keyboard flow through triage is complete.

### Task 15: Phase 4 — Budgets, Goals, Recurring (`redesign/papel-plans`)

**Files:** `components/budgets/*`, `app/(app)/budgets/{page,goals/[id]/page}.tsx`, `components/goals/*`, `components/subscriptions/*`, `app/(app)/recurring/page.tsx`, help chapters + mocks.

**Non-negotiables:**
- The period total is the peso `Note` on Budgets. Categories are `RuleMeter` rows with their Stamp, and groups are ruled sections with a subtotal line.
- Goal detail uses `Perforation` for contributions, and funding clamps stay visible as printed facts.
- Recurring is a ledger sorted by next date, with income and expenses separated by a double rule and next-billing dates as `meta`. Recurring has no Note.

**Acceptance:** over-budget reads without colour (double end rule plus flag mark). A goal at 100% prints the ok mark.

### Task 16: Phase 5 — Insights and Ask (`redesign/papel-insights`)

**Files:** `components/insights/*`, `app/(app)/insights/page.tsx`, `components/ui/chart.tsx`, `app/globals.css` (`--chart-2 … --chart-8`), `lib/palette.test.ts`, `components/ask/*`, `app/(app)/ask/page.tsx`, help chapters + mocks.

**Non-negotiables:**
- Load the **dataviz** skill before any chart code.
- Charts become engraved plates: ink lines, hairline axes in `--paper-line`, series told apart by **hatch pattern + stamp ink** (SVG `<pattern>` defs in `chart.tsx`), and no flat colour fills.
- The chart palette is re-derived as eight inks that clear 3:1 on `#eeebf5` and `#1d1829`. `chart-1` stays equal to `--ring`, so `lib/palette.test.ts` keeps passing with the surfaces updated.
- The spend donut becomes a ruled bar list if the comp round prefers it: the user decides in the concept roll.
- Ask is a ruled conversation sheet. Answers carrying figures print as `LedgerRow` excerpts. No Note on either screen.

**Acceptance:** every chart is readable in greyscale. Tooltips are paper slips.

### Task 17: Phase 6 — Settings, Welcome, Help, Legal (`redesign/papel-edges`)

**Files:** `components/settings/*`, `app/(app)/settings/{page,rules/page}.tsx`, `components/onboarding/*`, `app/welcome/page.tsx`, `app/(app)/help/page.tsx`, `components/help/*`, `app/{terms,privacy}/page.tsx`, `components/legal/*`.

**Non-negotiables:**
- Settings is ruled sections with no Note, and the rules list is a ledger. The sound toggle's description mentions the stamp in en and es.
- `/welcome` continues the login's violet band (the same composition as `app/login/page.tsx`). Each step is a slip, and progress is a `Serial`-styled counter (`1 / 7`) plus a `Perforation`.
- `/help` is **Read** mode: a paper page with a chapter rail (`section-nav.tsx`). Every mock sits in a `SpecimenFrame` and is rebuilt from the primitives. Re-check the mocks from Phases 1–5 against the live screens.
- Legal pages are paper with Archivo body, `legend` headings and a readable measure (max ~70ch).

**Acceptance:** help mocks match the live UI of every phase. Onboarding resume behaviour is unchanged (`lib/onboarding/resume.test.ts` still passes).

---

# Phase 7 — Close-out (`redesign/papel-closeout`)

### Task 18: Remove the incumbent system and record the world

**Files:**
- Delete: `components/ui/hero-card.tsx`, `components/ui/color-tile.tsx`, `components/ui/stat-pill.tsx`, `components/brand/spot-illustration.tsx` (if no longer used), `components/marketing/papel/fonts.ts`
- Modify: every importer of those files (switch to `Note`, `Stamp`, `ProofMark`, `@/app/fonts`), `app/globals.css` (drop `--hero`, `--hero-foreground`, `--gold*`, `--shadow-card-hover`, `.lift`, and any utility with no users)
- Modify: `DESIGN.md` (final), `PRODUCT.md` Brand Commitments (add "Papel Moneda is the whole-domain visual world")

- [ ] **Step 1: Swap the aliases**

Run: `rg -l "hero-card|color-tile|stat-pill|spot-illustration|marketing/papel/fonts" app components`
Replace each import with the Papel primitive (`HeroCard` → `Note tone="violet"`, `ColorTile` → `Stamp`, `StatPill` → `ProofMark` with the tone mapping from Task 5 Step 5), then delete the alias files.

- [ ] **Step 2: Remove dead tokens and utilities**

For each of `--hero`, `--hero-foreground`, `--gold`, `--gold-foreground`, `--shadow-card-hover`, `lift`, `bg-(--hero)`, `var(--hero)`: `rg -n "<name>" app components lib --glob '!*.test.*'`. If only the definition remains, delete it from `app/globals.css`.

- [ ] **Step 3: Whole-app audit**

Run `/impeccable audit app` and fix blocking a11y/perf/responsive findings in one batch. Then run the detector over `components app` and fix what is mechanical.

- [ ] **Step 4: Final DESIGN.md**

Spawn `impeccable-documenter` over the whole domain. DESIGN.md must end with the primitive table, tokens (pointing at `design/tokens.json`), type, ornament rules (one Note per screen), card face, sound, and a note that the Expo repo consumes `design/tokens.json`.

- [ ] **Step 5: Verify, commit, merge**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all pass.

```bash
git add -A && git commit -m "chore(design): retire the incumbent system; Papel Moneda is the whole domain"
git checkout main && git merge --no-ff redesign/papel-closeout
git branch -d redesign/papel-closeout && git push origin --delete redesign/papel-closeout 2>/dev/null; git push origin main
```

- [ ] **Step 6: Hand the tokens to native**

Tell the user that `design/tokens.json` is ready for `cb-co/tywin-native` to consume. That repo is private and separate, and this plan does not edit it.
