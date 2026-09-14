# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **Dominican consumers** managing everyday money — people who hold several cards from
several local banks, buy in *cuotas*, and are paid on the *quincena* cycle. Their situation is that
no bank in the market offers an aggregation API, so every competing product costs them manual typing
and gets abandoned. Their job is to know, without doing bookkeeping, what they own, what they owe,
and what is safe to spend before the next payday.

They are mobile-first (installable PWA, safe-area-aware chrome) and Spanish-speaking, with English
as a real second audience rather than a courtesy.

## Product Purpose

Cashly reads a Dominican bank or card statement, turns it into a categorised ledger, and keeps net
worth, budgets, subscriptions, and goals current from that ledger rather than from data the user
retypes.

Success at this stage is a **public launch where strangers activate unsupervised**. The product is
pre-launch; the activation event that matters is *first statement imported*, not first account
created. Design has to hold up with no one standing next to the user.

## Positioning

The app that **reads your Dominican bank statement, tracks your cuotas, and tells you what is safe
to spend until the next quincena.**

Three claims a neighbouring product could not truthfully copy today:

- A schema-constrained LLM statement extractor tuned for Spanish Caribbean layouts — it infers
  columns from horizontal spacing, scrubs PII, checksums against the statement's own arithmetic, and
  refuses to invent a number to make a balance close.
- Dominican money mechanics modelled at the database level: transfer tax, the same-bank network-fee
  waiver, cuotas, per-currency card sections.
- Card identity as a physical object — brand, network, and colour inferred from the name the user
  typed, then drawn as the card they carry.

Competing on "a better Mint" is explicitly not the position: Mint-likes lose on data entry.

## Operating Context

- Users arrive with **PDF statements** from local banks (Banco Popular and peers), often several per
  month across several cards, in mixed DOP/USD sections.
- A single statement can produce ~100 lines, which is why import is followed by a **triage ritual**:
  uncategorised lines grouped by merchant, one tap per group, saved as reusable merchant rules.
- Money is multi-currency by default. RD$ and US$ coexist inside one profile and one card.
- Screens in use: Overview, Wallet/Accounts (+ account detail), Transactions ledger, Budgets (+
  savings goals), Subscriptions, Insights, Imports triage, Ask (conversational query), Settings
  (+ merchant rules), Help guide, and a public marketing/login surface.

## Capabilities and Constraints

**Confirmed capabilities** — accounts across types and currencies with live-converted net worth;
transactions with FX rate locked at insert; credit-card groups with per-currency lines and
statement-anchored balances; statement import with backfill of limit/closing day/due day from the
first confirmed statement; import triage and merchant rules; budgets per category; savings goals with
read-time funding clamps; subscriptions and next-billing dates; insights and trends; an LLM "Ask"
query surface; data export; figure-mask privacy mode; en/es parity across the whole catalogue.

**Constraints future work must respect**
- **Supabase is a live linked project.** Migrations cannot be pushed by the agent; the human pushes
  them. Any UI must render correctly both before and after a pending migration lands.
- **No bank aggregation API** is available in this market and none is expected soon. Statement PDFs
  are the only bulk input.
- **i18n is non-negotiable**: no hardcoded user-facing copy; en and es ship together, and the in-app
  help guide is updated with every feature change.
- **Category and account colours are user data** stored as hex on user rows — never assume a colour
  is one of the shipped swatches.
- Statement extraction depends on the PDF having a text layer; scanned statements are out of reach
  today.

**Terminology (use the user's words)** — *cuota* (instalment), *quincena* (fortnightly pay cycle),
*estado de cuenta* (statement), `RD$` for Dominican pesos (never a bare `$`).

**Open product decisions** — activation is not yet measured anywhere in the app (no analytics
surface); bank-account statement import is still gated to cards only.

## Brand Commitments

- **Name: Cashly.** In use across the product and both message catalogues.
- **Spanish + RD$ are the first-run defaults.** A new Dominican profile should open in Spanish with
  `RD$` before the user touches a setting. The code today still defaults to English and USD — closing
  that gap is committed product direction, not an open question.
- Voice, as written in the existing catalogues: plain, calm, second person, no finance jargon and no
  cheerleading. Errors say what happened and what to do.

## Evidence on Hand

- `docs/product-audit-dominican-market.md` — full product/UX audit with stable refs (`UX-01`,
  `BUILD-08`, …) and completion state; the source of the positioning above.
- `docs/specs/` and `docs/plans/` — approved design specs and implementation plans per feature.
- `docs/playful-redesign-qa-guide.md`, `docs/savings-goals-test-guide.md` — QA walkthroughs.
- `app/globals.css` and `lib/palette.ts` — the incumbent visual system, documented in-file.
- `messages/en.json` / `messages/es.json` — the real product copy.

**Absences future work must not paper over:** there are no users yet, no testimonials, no press, no
usage metrics, no pricing, and no analytics. Nothing may be invented in any of those categories.

## Product Principles

1. **Every number should arrive, not be typed.** Any flow that adds manual entry to the critical path
   is a regression against the one thing that kills this category.
2. **The statement is the front door.** Import is a primary action wherever a screen is empty for
   want of data — never a settings-depth feature.
3. **Dominican by default, not by setting.** Spanish, RD$, cuotas, quincena, transfer tax: the local
   reality is the default path, not a localisation option layered on a US product.
4. **Refuse rather than guess.** Where money is concerned the product declines to produce a number it
   cannot justify (checksum guards, null categories over a fake "Other", FX-degraded warnings).
5. **Correctness is visible craft.** Locked FX rates, statement-anchored balances, and clamped goal
   funding are the product's trust argument and must survive every redesign.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA** — 4.5:1 for body text, keyboard-complete flows, visible focus, honoured
`prefers-reduced-motion`. The existing 3:1 identity-colour contrast contract (glyphs, icons, large
text on tiles) sits underneath AA and does not satisfy it for small text on coloured fills.
Both light and dark themes are first-class; light is the default.
