# Onboarding that sets the app up — design

The welcome flow (`/welcome`) asks for a name, a base currency, one balance
account and optionally one credit card, whose statement import then ends
onboarding. A user who finishes it still has to find Settings and three other
pages before the features that make Cashly useful work: the pay cycle is
silently `semimonthly`, there is no income baseline, no loans and no fixed bills,
so "safe to spend", the upcoming list and the coach all run on an empty picture.
This is audit item UX-11, extended.

Goal: everything a new user needs for the Overview to be truthful is asked once,
in onboarding, and never has to be configured again.

## Decisions

1. **One wizard, more steps.** Extend `components/onboarding/welcome-flow.tsx`
   rather than moving setup into an Overview checklist — the point is that the
   user does not configure again after onboarding.
2. **Resume from data, not from a stored step.** No migration. `/welcome`
   derives the resume step and the already-created rows from what exists.
3. **Loans are accounts**, created through a short form that maps onto the
   existing `loan` account fields (see *Loan mapping*).
4. **Several credit cards**, each with its own statement import; an import no
   longer ends onboarding.
5. **Income is a recurring income template.** `createSubscription` already
   syncs `profiles.pay_cycle` from the user's sole active income template, so
   the pay cycle is set by answering "¿Cuándo te pagan?", not asked separately.
6. **Bills are recurring expense templates** picked from presets.
7. Budgets and savings goals stay out of onboarding.

## Steps

| # | Step | Required | Asks | Writes via |
|---|---|---|---|---|
| 1 | About you | yes | display name, language (es/en, preselected from the current locale), base currency (DOP default) | `updateDisplayName`, `setLocale`, `updateBaseCurrency` |
| 2 | Main account | yes | type (checking/savings/cash/investment), name, currency, current balance — as today | `createAccount` |
| 3 | Credit cards | skip | list of cards added so far; "Agregar tarjeta" opens the existing stub form (`ImportCardStubStep`); each listed card has "Importar estado de cuenta" | stub creation as today; `StatementImportDialog` |
| 4 | ¿Cuándo te pagan? | skip | cycle: quincenal / mensual (+ day) / semanal (+ weekday) / irregular; net amount; destination account (default: step 2's account) | `createSubscription({ kind: "income", … })`, or `setPayCycle({ cycle: "monthly" })` for irregular |
| 5 | Préstamos | skip | repeatable short loan form (below) | `createAccount({ type: "loan", … })` |
| 6 | Gastos fijos | skip | preset chips; each selected chip expands to amount, day of month, paid-from account | `createSubscription({ kind: "expense", … })` per bill |
| 7 | Listo | — | summary of what was set up, each with an edit link to its page; "Ir al inicio" | `finishOnboarding` |

Skippable steps show "Ahora no" as the secondary action. `finishOnboarding`
keeps its guard that at least one account exists.

### Step 1 — About you

Language changes apply immediately: after `setLocale` the flow calls
`router.refresh()` so the remaining steps render in the chosen language. The
language control is a two-option segmented toggle, not a select.

### Step 3 — Credit cards

- The step renders the user's existing non-archived `credit_card` accounts as a
  list (name, last 4, "estado importado" if it has a confirmed statement).
- "Agregar tarjeta" shows `ImportCardStubStep`; on create, the card joins the
  list and the import dialog opens for it, as today.
- Closing or completing `StatementImportDialog` returns to the list. It no
  longer calls `finish()`.
- The primary action is "Continuar" once at least one card exists, "Ahora no"
  otherwise.

### Step 4 — Income

- Quincenal → `billing_cycle: "semimonthly"`; mensual → `"monthly"` with
  `anchor_day` 1–31; semanal → `"weekly"` with the weekday in the subscriptions
  table's Sunday=1..Saturday=7 scheme (the sync converts it).
- The template's currency is the destination account's currency, shown next to
  the amount and not independently editable.
- Name defaults to the localized "Salario".
- "Irregular / no fijo" creates no template and calls
  `setPayCycle({ cycle: "monthly", anchorDay: 1 })`.
- If an active income template already exists (resume), the step shows it with
  an edit link instead of the form.

### Step 5 — Loans

Short form fields: name, currency, **¿Cuánto debes hoy?**, **Cuota mensual**,
**Cuotas restantes**, **Día de pago**; "Más detalles" reveals optional **Tasa
anual (%)**. Added loans list above the form; "Agregar otro préstamo" resets it.

#### Loan mapping

`loan_status.outstanding_balance` amortizes from `principal` using only the
payments recorded against the account, with `term_months` as the payment count
that clears it. So a loan described from today is exact without its history:

| Onboarding field | `accountInput` field |
|---|---|
| ¿Cuánto debes hoy? | `principal` |
| Cuota mensual | `installment_amount` |
| Cuotas restantes | `term_months` (`original_term_months` left unset) |
| Día de pago | `payment_due_day` |
| Tasa anual (%) | `interest_rate` = value / 100 (unset if blank) |
| — | `start_date` = today (`YYYY-MM-DD`), `starting_balance` 0 |

The mapper is a pure function in `lib/onboarding/loan.ts` and the result is
validated by `accountInput` before `createAccount`.

### Step 6 — Fixed bills

Presets (en/es copy, category by seeded name):

| Preset | es | Category |
|---|---|---|
| rent | Alquiler | Housing |
| power | Luz | Utilities |
| water | Agua | Utilities |
| internet | Internet / cable | Utilities |
| phone | Teléfono | Utilities |
| insurance | Seguro | Health |
| other | Otro (free name) | none |

- Category is resolved against the user's categories by the seeded English
  name; if the user has no match the bill is saved with no category rather than
  a guessed one.
- Each selected preset: amount (currency follows the chosen account),
  `billing_cycle: "monthly"`, `anchor_day` = day of month, `account_id` =
  paid-from account (default: step 2's account).
- "Guardar gastos" creates all selected bills; any that fail stay expanded with
  their error, the saved ones collapse into the list.
- Existing expense templates (resume) are listed, and a preset already used by
  name is shown as added.
- Mapper: `lib/onboarding/bills.ts`, output validated by `subscriptionInput`.

## Resume and data flow

`/welcome/page.tsx` loads, in parallel: profile, non-archived accounts (type,
name, currency, last4), confirmed-statement flags per card, active subscriptions
of kind `income`/`expense`, and categories. A pure function
`lib/onboarding/resume.ts#resumeStep(snapshot)` returns the first incomplete
required step, else step 3:

- no display name → 1
- no non-card, non-loan account → 2
- otherwise → 3 (skipped optional steps are not remembered; a refresh shows the
  cards step again with what exists listed, and the user continues from there)

Back navigation is allowed on every step. Steps that create rows show the rows
that already exist, so going back never duplicates; step 2 with an existing
account shows it as done with an "Editar en Cuentas" link instead of the form.

Every write goes through an existing server action; nothing new is added server
side except the reads in `page.tsx`.

## Errors and edge cases

- Validation errors from zod surface inline on the field when the mapper can
  attribute them, else as a toast (current behaviour).
- A second income template can't be created in onboarding: step 4 shows the
  existing one instead of the form.
- A user who closes the tab mid-flow is still gated to `/welcome` (unchanged)
  and resumes as above.
- `finishOnboarding` failure keeps the user on step 7 with a toast.

## i18n and help guide

- All new copy under `Welcome.*` in `messages/en.json` and `messages/es.json`;
  preset names under `Welcome.billPresets.*`.
- Help guide (`app/(app)/help/page.tsx`, `components/help/mocks.tsx`) updated
  to describe the new setup steps, en + es.

## Testing

- Unit (vitest): `resumeStep`, the loan mapper (incl. percent → fraction and
  `accountInput` passing), the bill mapper (category resolution with and without
  a match, `subscriptionInput` passing).
- Manual browser pass with agent-browser on a fresh user: full run, skip-all
  run, refresh mid-flow on each step, language switch on step 1, two cards with
  one import, one loan, two bills; then confirm Overview shows income period,
  loan and bills in upcoming, and safe-to-spend subtracts them.

## Out of scope

Budgets, savings goals, regalía (BUILD-09), bank-account statement import,
editing existing loans/bills inside onboarding (links out instead).
