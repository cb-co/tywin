# Design: Papel Moneda (public pages)

Scope: the signed-out home page (`components/marketing/marketing-home.tsx`) and
`/login` (`app/login/page.tsx`, `components/auth/login-form.tsx`). The signed-in
app keeps its own system; this one is deliberately separate and lives in
`components/marketing/papel/`.

## Thesis

Money's own print language. A bank statement is re-issued as an engraved,
checkable document. It refuses the headline + phone mockup + feature-card grid.
Direction: banknote security print (form candidate 3 of 7, seed `101aa86f`).

## Story

A Dominican visitor sees their own *estado de cuenta* become a sorted ledger
with cuotas and one *Disponible* figure, believes Cashly reads the bank PDF
without typing, and creates a free account.

## Tokens (`papel.module.css`, `.page`)

| Role | Token | Value |
| --- | --- | --- |
| Note field (violet) | `--note` / `--note-deep` / `--note-line` | `#4a1f8c` / `#2b1157` / `#a488ec` |
| Text on note | `--note-ink` / `--note-ink-soft` | `#f8f5ff` / `#d9ccfa` |
| Peso orange | `--peso` / `--peso-line` | `#e0661c` / `#ffb27a` |
| Text on peso | `--peso-ink` / `--peso-ink-soft` | `#1f0e22` / `#4a2410` |
| Security paper | `--paper` / `--paper-2` / `--paper-line` | `#eeebf5` / `#ffffff` / `#cdc3e3` |
| Ink | `--ink` / `--ink-soft` / `--rule` | `#1b1530` / `#544a6c` / `#1b1530` |
| State | `--teal` (matches) / `--red` (error) | `#0e6e60` / `#b3302a` |
| Motion | `--ease-press` | `cubic-bezier(0.16, 1, 0.3, 1)` |

The violet and peso fields never invert. Paper sections go ink-dark at night.

## Type

One family: Archivo with the width axis (`fonts.ts`). The expanded cut carries
legends, the display headline and denomination numerals; the normal cut is
body. Tabular numerals for every amount (`.num`). No second family, no second
numeral system.

## Ornament

All ornament is generated, never clip-art (`guilloche.tsx`): rosettes are
stacked hypotrochoids, fields are interfering sine waves, drawn on a canvas in
`currentColor`. They "cut" themselves in over ~1.8s; under
`prefers-reduced-motion` the finished plate is drawn in one frame. Bilingual
microprint frames (`microprint.tsx`, copy in `Marketing.microprint`) and serial
numbers (`CL 2026 000417 A`) frame the note. Ornament is `aria-hidden` and
never carries content.

## Layout

1. Hero: full-bleed violet note in a microprint frame; two-line expanded
   headline, one primary CTA (`/login?mode=up`), quiet "I have an account";
   statement sheet printing row by row into a ledger sheet (`statement-specimen.tsx`).
2. Proofs: three demos (finds columns, redacts personal data, sums must match).
3. Disponible: peso-orange note with one figure and a quincena timeline.
4. Cards and cuotas: cards drawn from the typed name; perforated cuota strips.
5. Close: violet note, second CTA. Footer: Help, Terms, Privacy.

`/login` reuses the violet field as a note panel (a band on phones) beside a
security-paper form. `?mode=up` opens sign-up directly.

## Rules

- Every specimen number is made up and labelled as such (`sampleData`,
  `cardsTyped`, `specimenLabel`). Never present illustrative figures as real.
- Copy lives in `messages/{en,es}.json` (`Marketing`, `Login`); keep both in
  parity. Microprint and bank terms (cuotas, quincena) stay Spanish in both.
- State is shown as ink density and rule weight, not colour alone.
- Reuse `Guilloche`, `Microprint`, `Serial`; do not add raster ornament.

## Provenance

No shipping raster assets: everything is CSS, SVG, canvas or Lucide icons, and
the only font is Archivo via `next/font`. The PNGs in `.impeccable/review/` are
review screenshots, not shipped.

## Verdict

Finish review (2026-09-19): typecheck, lint and en/es key parity clean; desktop
hero, mobile home and mobile/desktop login reviewed from screenshots. Not yet
re-verified live after the last edits (dev server was not started).
