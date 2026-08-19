# Cashly — Product & UX Audit (Dominican Edition)

> **Scope:** Product, UX, and feature audit of the whole app, with a plan to make it the default
> personal-finance app in the Dominican Republic.
> **Date:** 17 Aug 2026 · **Repo:** `tywin` · **Market:** República Dominicana
>
> Source of this document: the audit artifact at
> <https://claude.ai/code/artifact/dc43873a-f235-47c2-9b72-84d9d26ad066>
>
> **How to use it:** each finding has a stable ref (`UX-01`, `CUT-03`, `BUILD-08`, `CHK-02`). Pick a
> ref, work it in its own session, tick its box. Refs are referenced across sections, so don't
> renumber them.

## A very good app that is *not yet* a Dominican one

Cashly is further along than most personal-finance apps ever get. The gap between it and the default
money app in the DR is not polish — it is the handful of things Dominicans actually do with money,
none of which it models yet.

| Verdict | Count |
| --- | --- |
| Keep as-is | 7 |
| Fix | 14 |
| Cut | 7 |
| Build | 17 |

---

## 01 · Where it stands

I read the whole app: 8 routes, ~130 components, 43 migrations, both message catalogues, and the
three LLM pipelines. This section is not throat-clearing — the strengths determine which strategy is
available to you.

### Five things that are genuinely rare

- **The statement importer.** A schema-constrained Gemini extractor with a PII scrubber, a checksum
  guard against the statement's own arithmetic, duplicate-section rejection, per-currency section
  mapping and a merchant-rule memory. It reads Spanish Caribbean layouts, infers columns from
  horizontal spacing, and refuses to invent numbers to make a balance close. This is a moat and you
  are treating it like a settings screen.
- **Money modelling with real integrity.** Transactions lock their FX rate at insert; balances
  convert live and are explicitly kept out of that path. Card balances anchor to a statement rather
  than drifting from a starting number. Goal funding is a read-time clamp, not a trigger — so
  backdated imports can't corrupt it. Loan interest and cost-of-carry are separated because one is
  paid and one is projected. Most fintech products get exactly none of this right.
- **Card faces.** Inferring a card's real colour and network from the name the user typed, then
  drawing the physical object, is the best idea in the product. In a market where people carry three
  cards from three banks and think of them as objects, this is the thing they will show someone else.
- **Transfer tax and network fees as first-class concepts.** No international app models the DR's
  transfer tax or the same-bank fee waiver. You do, at the database trigger level.
- **Craft.** Container-query layouts, lazy chart bundles, a figure-mask privacy mode, per-currency
  formatting that renders `RD$` instead of an ambiguous `$`, safe-area-aware mobile chrome, es/en
  parity across 891 keys. The codebase comments reason about design decisions, not syntax.

### And the one problem underneath everything

Cashly is a *bookkeeping* app that occasionally gives advice. Every number it shows is a number the
user already entered. The four screens that generate value — Wallet, Budgets, Insights,
Subscriptions — all consume data that arrives through manual typing, and manual typing is why 90% of
personal-finance apps are abandoned in week three.

The statement importer is the escape hatch from that, and it is currently reachable only from a
credit card's own detail page, only for credit cards, and only if the PDF has a text layer. Almost
every recommendation below is a consequence of that one observation.

---

## 02 · Positioning — the strategic call

You cannot win the DR by being a better Mint. Mint-likes lose on data entry, and no bank here will
give you an aggregation API in the next two years. What you *can* own is the set of money behaviours
that are specific to this country and that no international product will ever bother to model.

> ### Cashly is the app that reads your Dominican bank statement, tracks your cuotas, and tells you what is safe to spend until the next quincena.
>
> Three claims, all buildable on what you already have, none of them served by any product in this
> market today. Everything else in the app is supporting cast for those three.

That thesis has an immediate consequence for defaults. Today a new profile is created with
`base_currency = 'USD'`, the default locale is `en`, and the brand is an English word. A Dominican
user's first screen should say `RD$`, in Spanish, before they touch a setting. Accept-Language
negotiation already handles most of the locale case — the currency and the copy do not.

---

## 03 · UX and usability findings

Ranked by how much each one costs you in retention, not by how hard it is to fix.

### UX-01 · Fix · High — Quick Add asks for ten things to log a RD$250 lunch

- [x] Done (17 Aug 2026)

The ⌘K / FAB dialog renders the full `TransactionForm`: type, source account, amount,
cross-currency rate, destination, category, apply-tax, apply-fee, exclude-from-budget, date,
description. It is a correct form and a hostile one. The single most repeated action in the product
is its heaviest interaction, and on mobile it opens a 90vh scrolling sheet.

**Do this** — Amount first, numeric keypad focused on open. Category as a horizontal chip rail
(last-used first). Account defaults to last-used and collapses to a one-line summary you tap to
change. Everything else — rate, tax, fee, budget exclusion, notes — behind a single "More"
disclosure. Target: three taps and under four seconds.

**Done** — `TransactionForm` grew a `compact` prop (`components/transactions/transaction-form.tsx`):
amount first and autofocused, a most-used category rail, last-used account and shared defaults
served from the server, and every remaining field behind a "More details" disclosure in the same
panel. Spec and plan in `docs/specs/2026-08-17-quick-add-compact-design.md` and
`docs/plans/2026-08-17-quick-add-compact.md`. Help guide updated to match.

### UX-02 · Fix · High — The best feature in the app is buried three levels deep

- [x] Done (18 Aug 2026)

Statement import lives in a panel on `/accounts/[id]`, so a user must already own a credit card, have
added it, and have navigated into it to discover the one feature that removes manual entry from their
life. Onboarding never mentions it. The overview never mentions it. Six Insights empty states say
"Import a card statement to see…" and none of them link anywhere.

**Do this** — Make "Importar estado de cuenta" a primary action on Overview and Wallet. Add it as
onboarding step 4 with a skip. Make every empty state that mentions it a link to it. Measure
activation as *first statement imported*, not first account created.

**Done** — The import flow moved out of `StatementsPanel` into a self-contained dialog
(`components/statements/statement-import-dialog.tsx`) that resolves its own target: it lists the
user's cards, picks the only one, asks which of several, or creates the first. It is now reachable
from Overview (a callout that appears only when a statement is due or none was ever imported —
`lib/overview/import-prompt.ts`, tested), the Wallet header, the three Insights cards that go empty
for want of a statement, a new skippable onboarding step 4, and still from the card's own page, where
the history list stayed.

The rule that made it cheap enough to ask for in onboarding: a card can be created as a *stub* from
three fields — name, currency, last 4 — with null limit, closing day and due day, because those are
exactly the three the first confirmed statement backfills (`lib/statements/backfill.ts`, tested).
Backfill only ever fills a null column, so it never overwrites a value the user set. A section whose
currency matches no line on the card can promote that card into a card group by adding the sibling
line in place. Spec and plan in `docs/specs/2026-08-18-statement-import-promoted-design.md` and
`docs/plans/2026-08-18-statement-import-promoted.md`. Help guide updated to match.

**Remaining** —
- [ ] Activation measured as *first statement imported*. This is a SQL query over
      `statement_imports`, not a build — there is no analytics surface in the app to hang it on yet.
- [ ] Bank-account statements. The `notACard` gate in `app/(app)/accounts/statement-actions.ts`
      still stands; lifting it is BUILD-02, not this item.

### UX-03 · Fix · High — After an import, categorising 80 lines is 80 dialogs

- [ ] Done

`saveMerchantRule` exists and works, but the only way to reach it is to open one transaction, change
its category, and tick a checkbox. A single Banco Popular statement can produce a hundred lines.
There is no queue, no bulk select, no rules screen, and no way to see what is still uncategorised.

**Do this** — A triage view: "32 transactions need a category", grouped by merchant, one tap per
group, keyboard-navigable on desktop. Then a Rules screen under Settings listing every saved merchant
rule so people can correct a bad one. This turns import from a chore into a ritual. (Pairs with
BUILD-13.)

### UX-04 · Fix · High — The ledger silently stops at 200 rows

- [x] Done — main ledger (17 Aug 2026). See *Remaining* below.

`getTransactions` hard-limits to 200 and account activity to 100, with no pagination and no
indication that anything was truncated. Two imported statements plus a month of manual entries
reaches that. A user who scrolls to the bottom of their history and finds it simply ends will not
trust anything else the app tells them. Search is `ilike` on the description column only — no amount,
no merchant, no category text.

**Do this** — Cursor pagination on `occurred_at`, infinite scroll on mobile. Extend search to amount
and merchant. Add a month jump-list to the ledger's left edge.

**Done** — `getTransactions` now returns one 50-row page plus a keyset cursor on
`(occurred_at, id)`; `/transactions` server-renders page one and the client pages the rest in via a
`loadTransactions` server action, driven by an IntersectionObserver on the Load-more button (so
scroll, click and keyboard all work). Every filter — type, account, category, date range, search —
moved from a client-side pass over the fetched array into Postgres, so filters now run against the
whole history rather than the first page. Search covers `description`, `notes`, and both amount
columns when the query is entirely numeric (`lib/transactions/search.ts`, tested). The end of the
ledger now says so, with a count.

QA turned up that `notes` was unreachable — the column, the zod schema, `toRow()` and the
statement-edit path all handled it, and `fromStatementHint` even promised it was editable, but no UI
ever rendered an input, so all rows were null. Added a Notes textarea to the transaction form
(`components/ui/textarea.tsx`), never disabled on statement-imported rows: their description is the
issuer's own descriptor and is locked, which makes notes the only place to record what a line like
`CARDNET PEAJES-RS` actually was.

**Remaining** —
- [ ] Account detail activity is still capped at 100 rows (`getAccountTransactions`). It feeds
      `BalanceChart` as well as the activity list, and the chart needs full history to plot, so
      paginating it means splitting those two consumers first.
- [ ] Month jump-list. Needs a distinct-months aggregate the schema has no cheap path to; the
      server-side date-range filter covers the same need for now.

### UX-05 · Fix · High — Budgets are calendar-month; Dominican salaries are not

- [ ] Done

Most of the country is paid *quincenal* — the 15th and the 30th. A budget that resets on the 1st
means a user is "on track" on the 14th while actually broke, and the spending-pace chart paces
against a period their money does not follow. This is not a small mismatch; it is the reason a budget
feels wrong to a Dominican user without them being able to say why.

**Do this** — A pay-cycle setting (mensual / quincenal / semanal) on the profile, driving budget
periods, the spending-pace x-axis, and the "safe to spend" figure in UX-06. Keep the monthly view
available; make quincenal the default for a DOP base currency.

### UX-06 · Build · High — The app computes every input to "safe to spend" and shows none of them together

- [ ] Done

Net worth is the hero figure on Overview. Net worth is the least actionable number in personal
finance — it moves slowly, it includes a car, and nobody makes a decision with it. The decision people
actually make, ten times a day, is *can I spend this?*

You already have: available balance net of goal commitments (`lib/goals/funding`), upcoming card
minimums and due dates (`lib/overview/card-due`), loan installments, subscription charges, and budget
remaining.

**Do this** — Replace the Overview hero with **Disponible hasta el 30** — balance minus committed
savings, minus cuotas due, minus subscriptions before payday, minus the card minimum. Demote net
worth to a secondary stat. This one change makes the app a daily open instead of a weekly one.

### UX-07 · Fix · High — Insights is eleven cards answering three different clocks

- [ ] Done

One page carries net worth (6-month), cash flow (trend), savings goals (cumulative), spending pace
(month), spend distribution (month), budget bars (month), card payments (month), transfer costs
(YTD), debt health (now), cost of carry (last statement), loan interest (mixed), cashback (YTD), cost
of ownership (YTD). The source comments openly wrestle with the fact that a card sits under a month
picker it does not obey. That is the code telling you the page has too many jobs.

**Do this** — Insights answers four questions and nothing else: where did the money go, am I on pace,
what is my debt costing me, is my net worth moving. Move cashback, cost of ownership, cost of carry
and welcome-bonus progress onto a per-card **"Boleta de la tarjeta"** — a report card on the card's
own page, where a user comparing two cards will actually look for them. Move transfer costs into
Settings → fees, or cut it.

### UX-08 · Fix · Medium — Mobile navigation costs an extra tap on the second-most-used screen

- [ ] Done

The bottom nav is Wallet · Activity · Overview · Budgets · Insights, where "Activity" opens a sheet
that then offers Transactions or Subscriptions. Transactions is the highest-frequency destination in
the app and it is behind a chooser. Meanwhile a 60px FAB floats above a nav pill, and the layout
reserves 152px of bottom padding to clear both — a sixth of a small phone's screen spent on chrome.

**Do this** — Four tabs plus a centre action button: Inicio · Movimientos · **+** · Presupuesto ·
Tarjetas. Subscriptions becomes a filter chip inside Movimientos — a recurring charge is a
transaction with a schedule, not a separate noun. Recovers ~80px of vertical space and one tap.
(Pairs with CUT-06.)

### UX-09 · Fix · Medium — The budget percentage can be reassuring and wrong

- [ ] Done

"Budget used" totals only categories that have an amount set. Spend RD$40,000 in categories you never
budgeted and the header still reports a comfortable 62%. There is also no rollover, no "unbudgeted"
line, and income has no categories at all — so the budget can never answer "did I spend more than I
earned this period?", which is the only budgeting question most people have.

**Do this** — Add an *Unbudgeted* row that always shows and always counts. Show income-minus-expense
for the period at the top of the page. Offer opt-in rollover per category.

### UX-10 · Fix · Medium — The loan form needs a 60-word paragraph to be usable

- [ ] Done

The hint reads, in part: "Enter the loan as it stands today, not at origination: principal is what you
owe now, term is how many installments are left… Original term is display-only." When a form needs an
essay, the form is asking the wrong question.

**Do this** — Two modes on a segmented control. *"Ya lo tengo"* → today's balance, remaining
installments, current rate. *"Lo acabo de sacar"* → original principal, term, rate, start date, and
the app derives today's position from the amortisation table it already computes. The essay
disappears.

### UX-11 · Fix · Medium — Onboarding never asks the two questions that make the app work

- [ ] Done

Three steps: name, base currency, one cash account. A user finishes setup with a checking balance and
an empty everything-else. The app cannot pace, cannot warn, cannot recommend, and the LLM coach has
nothing to coach about.

**Do this** — Two more steps, both skippable: *"¿Cuándo te pagan?"* (quincenal / mensual + amount,
which seeds both the pay cycle and the income baseline) and *"¿Tienes tarjeta de crédito?"* → add the
card → offer the statement import right there. A user who imports during onboarding has a populated
app before they ever see the dashboard.

### UX-12 · Fix · Medium — Tax and fee toggles ask the user something the app already knows

- [~] Partial (17 Aug 2026) — the quiet fee line ships in Quick Add's compact mode only; the full
      form on an account's page still shows both toggles as peer fields.

Every payment form shows "Apply transfer tax" and "Apply network fee" as peer fields. The database
already resolves same-bank waivers from `bank_id` equality, and the tax rate is a per-account setting.
The user is being asked to confirm a derivation.

**Do this** — Compute both, show the result as a quiet line — "+RD$45 impuesto · comisión exenta,
mismo banco" — with an edit affordance. Keep the logic; remove the interrogation.

### UX-13 · Fix · Medium — Statement import fails silently on scanned PDFs

- [ ] Done

`extractStatementText` reads the pdf.js text layer. Several DR issuers send image-only PDFs, and some
users will photograph a paper statement. Those all land on "That file couldn't be read as a PDF",
which reads as a bug in your app rather than a property of their file.

**Do this** — When the text layer is empty or under a threshold, send the PDF pages to Gemini as
images — same provider, same schema, no new dependency. Failing that, say what is wrong: "Este PDF es
una imagen escaneada", with a path forward.

### UX-14 · Keep · Low — Don't touch the visual system

- [ ] Acknowledged

The card faces, brand glyphs, hero gradient, colour tiles, count-up figures, spot illustrations and
rise animations are a coherent, warm, non-templated identity. The figure mask is a better privacy
feature than most banking apps ship. The only visual problem in the product is *hierarchy* on Insights
(UX-07), not style. Spend the design budget on information architecture, not on a repaint.

---

## 04 · Cut list

Every one of these costs maintenance, testing, translation across two catalogues, and a paragraph in
the help guide, and none of them earns a retained user.

### CUT-01 — The hand-written help guide

- [ ] Done

`app/(app)/help/page.tsx` is 371 lines plus 165 message keys plus a `mocks.tsx` of fake screenshots,
and it duplicates the entire product in prose. You have a standing rule to update it with every
feature change — that is a tax you pay forever, and the guide is stale the moment anyone forgets.
Replace with a "?" per screen opening a two-paragraph contextual explainer, plus a short
getting-started page. Delete the mocks.

### CUT-02 — Grid/table view toggles on Budgets and Subscriptions

- [ ] Done

Two layouts, two sets of responsive behaviour, two sets of bugs, on screens with fewer than fifteen
rows. Users pick one and never switch. Choose the better one per screen and delete the other.

### CUT-03 — Property & assets as a net-worth component

- [ ] Done

A manually-entered Toyota Corolla in the net-worth hero is vanity accounting: it never updates, it is
never liquid, and it makes the headline figure unusable for any decision. Either drop the type, or
keep it and default it *out* of net worth behind a "Incluir bienes" toggle.

### CUT-04 — Welcome-bonus tracking

- [ ] Done

Sign-up spend bonuses are a US card-churning behaviour. Dominican issuers compete on cashback, cuotas
and airline miles, not on "spend RD$X in 90 days". It costs you three schema columns, a co-validation
rule, a progress component and a help section. Validate with ten real users before keeping it; my
expectation is that it is dead weight here.

### CUT-05 — Sound effects as a top-level setting

- [ ] Done

A sound library, a provider, an asset folder and a Settings row given the same visual weight as base
currency. In a finance app opened in public, most people turn this off immediately. Keep the delight
if you love it, but demote the row and default it off.

### CUT-06 — Subscriptions as a separate top-level noun

- [ ] Done

A subscription is a transaction with a schedule and a logo. It has its own page, its own nav cell, its
own form, its own record-charge dialog, and its own FX estimate hint — and the user still has to log
every charge manually, which is exactly the work the page was supposed to save. Fold it into
Movimientos as a "recurrente" filter and a schedule field on the transaction itself. Keep the brand
glyphs; they are lovely. (Pairs with UX-08.)

### CUT-07 — Investment accounts with a static balance

- [ ] Done

An investment account is currently a number the user must remember to update, which means it is always
wrong. Either cut the type, or make it real: a *certificado financiero* with a rate, a term and a
maturity date that accrues on its own. In the DR, where DOP certificates pay meaningfully more than a
savings account, the second option is worth building (see BUILD-16).

---

## 05 · What to build

Ordered by how much distance each one puts between you and a generic budgeting app in this market.
The first seven are the product; the rest are the business.

### Tier 1 — the moat

#### BUILD-01 · High — Cuotas, the single most Dominican thing about credit

- [ ] Done

"Compra en cuotas" at 0% is how large purchases happen here: a refrigerator becomes twelve monthly
charges, and people routinely carry four or five plans at once with no idea what they have committed.
Your extractor *already* emits a `sectionKind: "installments"` section — you just summarise it and
move on.

**Model it properly** — A purchase split into N cuotas: amount, cuotas paid, cuotas left, monthly
commitment, date the plan ends. Then the numbers nobody in this market can see today: *"RD$18,400/mes
comprometidos en cuotas hasta marzo"*, a "free of cuotas" date, and a warning when a new plan pushes
committed spend past a threshold. This alone is a reason to switch apps.

#### BUILD-02 · High — Statement import for bank accounts, not just cards

- [ ] Done

Every DR bank emails a monthly *estado de cuenta* for checking and savings. Your extraction engine is
already generic over sections, currencies and line kinds — the constraint "statements can only be
imported on credit cards" is a product decision, not a technical one. Lifting it turns the app from
"type everything" to "upload two PDFs a month", which is the difference between a tool people keep and
one they don't.

#### BUILD-03 · High — Push notifications for due dates

- [ ] Done

You ship a PWA with a service worker, an install prompt, and an "Upcoming" rail already holding card
due dates, loan installments and subscription charges — and you never tell anyone. A late card payment
in the DR costs a penalty fee plus interest that your own cost-of-ownership card then dutifully
reports after the fact.

**Highest retention-per-hour in the whole list** — Web Push on the existing service worker. Three
notifications: card due in 3 days, cuota charge tomorrow, budget 90% used. Nothing else, ever — a
finance app that over-notifies gets uninstalled.

#### BUILD-04 · High — A Dominican catalogue: banks, issuers, billers

- [ ] Done

Banks are per-user free text today, so "Banco Popular" and "Popular" are two different institutions and
the same-bank fee waiver silently fails. Seed the real list — Popular, BanReservas, BHD, Scotiabank,
APAP, Banco Caribe, Promerica, Santa Cruz, Ademi, Vimenca, La Nacional, Bancamérica — with logos and
brand colours, and let users add their own on top.

Then the same for recurring billers: EDESUR / EDEESTE / EDENORTE, CAASD / INAPA, Claro, Altice, Viva,
Wind Telecom, plus the ARS providers. A user picking "EDEESTE" from a list with a logo and a typical
billing day is a ten-second setup instead of a form.

#### BUILD-05 · High — The peso-versus-dollar answer

- [ ] Done

Multi-currency net worth is already correct. What no app in this market shows is the thing every
Dominican with savings actually worries about: *what did holding pesos cost me this year?* You have
twelve-hourly rates and dated balances — the calculation is available.

**One card, two figures** — Currency mix of net worth (68% DOP / 32% USD), and DOP purchasing power
against USD year-to-date. Stated as an observation, never as advice — your Terms already disclaim
financial advice and the recommendation prompt already forbids naming products. Keep that discipline.

#### BUILD-06 · High — Debt payoff planner

- [ ] Done

You extract each card's APR from its statement, compute cost of carry per card, amortise every loan,
and know each minimum payment. You are one screen away from "paga primero esta tarjeta y ahorras
RD$14,200". Avalanche and snowball, with a what-if slider for an extra RD$5,000/month. This is the
highest-value output the statement importer enables and it does not exist yet.

#### BUILD-07 · High — Export, because you already promise it twice

- [ ] Done

The marketing home says data is "exportable or deletable any time from Settings". The Privacy Policy
says "If you'd like help exporting… contact us." There is no export anywhere in the codebase. That is
a broken promise on the landing page and a weak spot in a privacy policy. CSV of transactions plus a
JSON dump is a day of work; ship it or change the copy this week.

### Tier 2 — the reasons people stay, and tell someone

#### BUILD-08 · Medium — San / sociedad, the rotating savings club

- [ ] Done

A *san* is how an enormous share of this country saves: N people, a fixed contribution each cycle, one
payout per cycle, and you know your turn number. It is invisible to every finance app on earth and it
fits your goals model almost exactly — contributions already exist, backing already clamps to real
balances.

**What it needs** — Participants count, contribution amount, cycle, your turn number → the app derives
your payout date, total in, total out, and shows the san alongside savings goals. This is the feature
people screenshot and send to their group chat.

#### BUILD-09 · Medium — Regalía pascual, and the December problem

- [ ] Done

The thirteenth salary in December is a fixed, legally-mandated, entirely predictable income event that
reshapes the financial year for every formally employed Dominican — and December is also when spending
blows through every budget. An app that knows the regalía is coming can plan against it months out.

**Make it a first-class event** — A scheduled income entry derived from the salary the user gave at
onboarding, a December budget that accounts for it, and one honest choice offered in November: put it
against cuotas, against a card balance, or into a goal — with the interest saved shown for each.

#### BUILD-10 · Medium — Sueldo neto, the take-home calculator

- [ ] Done

Gross salary minus AFP, minus SFS, minus ISR withholding, equals what actually lands. Everyone here
has done this arithmetic on paper and nobody is sure they got it right. Build it as a standalone
calculator that then seeds the budget with a real income figure — and as a public, un-authenticated
page it becomes your single best acquisition channel, because people search for exactly this.

**Requirement** — Rates and ISR brackets change annually. Store them as dated configuration, show the
year the figures are from, and treat updating them as a calendar obligation, not a code change.

#### BUILD-11 · Medium — Shared household

- [ ] Done

Dominican household finances are collective — couples, parents and adult children, and money that moves
between them constantly. Every user of this app today is modelling a household as one person. A shared
space with per-account visibility (some things shared, some private) is the difference between one user
and three per household, and it is the strongest organic growth mechanism available to you.

#### BUILD-12 · Medium — The monthly report, built to be shared on WhatsApp

- [ ] Done

WhatsApp is the distribution layer of this country. Your daily LLM recommendation is already good
writing about someone's real numbers — the monthly version of it, rendered as a single image card with
the figure mask respected by default, is a growth loop that costs you one route and one canvas render.

#### BUILD-13 · Medium — Merchant rules, surfaced

- [ ] Done

The primitive exists. Give it a screen: every rule, editable, with a count of how many transactions it
has categorised. Then let the importer apply rules automatically and report "68 de 80 categorizadas
automáticamente" — which is the moment a user decides this app is worth keeping. (Pairs with UX-03.)

#### BUILD-14 · Medium — Biometric lock on the installed app

- [ ] Done

The figure mask is a good privacy feature aimed at shoulder-surfing. The complement is a lock on open —
WebAuthn on the installed PWA, with the mask as the pre-unlock state. In a market with real concerns
about phone theft, "se bloquea con tu huella" is a line on the landing page that converts.

### Tier 3 — once the first two tiers are real

#### BUILD-15 · Low — Fiao, informal credit at the colmado

- [ ] Done

A running tab at the corner store is a real liability for a large share of the population and appears in
no financial product anywhere. A lightweight "I owe / they owe me" ledger with a person's name, running
balance and settle-up action would be used daily by people the formal system does not serve.

#### BUILD-16 · Low — Certificados financieros with real accrual

- [ ] Done

The fix for CUT-07. Rate, term, maturity, accrued interest to date, and a maturity reminder. Pairs
naturally with BUILD-05: money sitting in a checking account while DOP certificates pay a meaningful
rate is the most common avoidable loss in Dominican personal finance.

#### BUILD-17 · Low — Negocio mode

- [ ] Done

A large share of your likely users run something on the side. One toggle that tags an account or a
transaction as business, then keeps two ledgers that roll into one net worth. Not accounting software —
just the separation, which is all most people need.

---

## 06 · Correctness — defaults and edges to check this week

Small changes, disproportionate consequences. The first two are the kind of thing that quietly makes
every figure in the app slightly wrong.

### CHK-01 — Transfer tax default is `0.0020`

- [x] Verified (17 Aug 2026) — **no change needed; the audit was wrong**

The audit cited Ley 288-04's 0.15% without accounting for the July 2026 increase that raised the tax
on cheques and electronic transfers to **0.20%**. The shipped default of `0.0020` is the current
correct rate, and `taxRatePlaceholder` already documents it as `"0.002 = 0.20%"`.

The field stays per-account configurable: `transfer_tax_rate numeric(18,8) not null default 0.0020`
carries no CHECK constraint, so any rate stores and computes. Note that it is a **decimal fraction,
not a percent** — 0.25% is entered as `0.0025`; entering `0.25` means 25% and would pass both the
column and the zod rule (`min(0).max(1)`). That 100× typo is left unguarded deliberately: the fee
preview line on the transaction form shows the computed amount before save, so it surfaces on the
next entry.

### CHK-02 — Base currency default is `'USD'`

- [x] Changed (17 Aug 2026) — migration pushed

A DR-first product should create profiles in DOP and offer USD as the alternative. Today a Dominican
user's first net-worth figure is in the wrong currency until they find Settings.

**Done** — `DEFAULT_BASE_CURRENCY = "DOP"` and `baseCurrencyOf()` in `lib/profile.ts` replace the
seventeen scattered `profile?.base_currency ?? "USD"` fallbacks, so the read-side default lives in
one place. Migration `20260817120000_base_currency_default_dop.sql` sets the column default to
`'DOP'`. Existing profiles are deliberately left alone: every stored transaction carries an
`exchange_rate` derived against the base currency in force when it was inserted, so rewriting the
base under those rows would reconvert history against a currency it was never denominated in.
Help-guide mocks updated to match.

**Pushed** — confirmed by the repo owner on 17 Aug 2026; new profiles now get `'DOP'` from the
column default, not just the app-side fallback.

### CHK-03 — FX failure falls back to 1:1

- [x] Done (18 Aug 2026)

`convertToBase` falls back to a 1:1 rate when the rate table is unavailable. At roughly 60 DOP to the
dollar, one failed fetch turns RD$500,000 into a $500,000 net worth. Transactions carry an "FX
fallback" badge; balances carry nothing. Show a degraded-state banner on any total computed without
live rates.

**Done** — The 1:1 fallback stays: dropping a holding out of a total is worse than distorting it, and
a rejected save on a failed FX fetch is worse than both. What changed is that the distortion is no
longer silent. `unconvertedCurrencies` (`lib/fx.ts`, tested) names the currencies that went into a
total at 1:1, and `getOverview` and `getNetWorthHistory` each return that list alongside their
figures. `FxDegradedNotice` (`components/fx/fx-degraded-notice.tsx`) renders under the net-worth hero
on Overview and at the top of Insights, listing the affected currencies against the base.

The list is empty for a single-currency user and on every healthy fetch, so both pages mount the
notice unconditionally and it costs them nothing — the warning only exists when the totals above it
are actually wrong. Help guide updated to match.

**Remaining** —
- [ ] The LLM coach still reasons off the distorted snapshot (`lib/overview/recommendation/`); it has
      no way to know the net worth it was handed is a 1:1 artefact.
- ~~A second FX provider (CHK-06)~~ — dropped. Visibility is the fix; a second provider is not.

### CHK-04 — Ledger limit of 200 rows

- [ ] Verified / changed

Silent truncation with no pagination — see UX-04.

### CHK-05 — Export promise, not built

- [ ] Verified / changed

Claimed in marketing copy and in the Privacy Policy — see BUILD-07.

### CHK-06 — Single FX provider (`open.er-api.com`)

- [x] Dropped (18 Aug 2026) — accepted risk

One free, unauthenticated endpoint, 12-hour cache, no fallback provider. Every multi-currency figure in
the app depends on it.

**Won't do** — A second provider doubles the integration surface, the cache logic and the ways rates can
disagree, to protect against an outage that lasts hours and degrades to a visible, labelled 1:1 state
(CHK-03). The rate table is cached for 12 hours, so a fetch has to fail for half a day before anyone
sees it. If the endpoint disappears permanently, swapping the single source is a small change made once
— not a fallback chain maintained forever.

### CHK-07 — Card networks limited to visa · mastercard · amex

- [ ] Verified / changed

Correct call for the DR. Worth adding local issuer marks (Popular, BHD, BanReservas) alongside the
network mark — recognising the bank is what makes the card face land.

---

## 07 · Three horizons

### Now · 4–6 weeks — Stop the leak

- [x] Quick Add rebuilt, amount-first (UX-01)
- [x] Import promoted to a primary action (UX-02)
- [ ] Categorisation triage + rules screen (UX-03, BUILD-13)
- [x] Ledger pagination (UX-04) — main ledger done; account activity still capped
- [x] FX degraded state (CHK-03) — ~~CHK-01~~ no change needed, ~~CHK-02~~ done and pushed
- [ ] CSV export (BUILD-07)
- [ ] Cut list 01–06

### Next · 2–3 months — Become Dominican

- [ ] Cuotas tracker (BUILD-01)
- [ ] Quincena pay cycle + safe-to-spend (UX-05, UX-06)
- [ ] Bank statement import (BUILD-02)
- [ ] Push notifications (BUILD-03)
- [ ] Bank & biller catalogue (BUILD-04)
- [ ] Insights cut to four answers; card report card (UX-07)

### Later · 6 months — Grow

- [ ] San tracker (BUILD-08)
- [ ] Regalía planning (BUILD-09)
- [ ] Sueldo neto calculator as a public page (BUILD-10)
- [ ] Shared household (BUILD-11)
- [ ] Shareable monthly report (BUILD-12)
- [ ] Debt payoff planner (BUILD-06)

---

## 08 · One number to run against

> **Users who imported a statement in the last 35 days.**

Not signups, not accounts created, not DAU. A user who uploads a statement every month has accurate
data, gets real insights, and has a reason to open the app tomorrow. A user who does not is typing into
a spreadsheet with nicer fonts, and will stop. Every item in the Now horizon exists to move that one
number.

Two supporting metrics: **time to log a transaction** (target under four seconds from tap to saved) and
**share of imported lines auto-categorised** (target 85% by the third statement).
