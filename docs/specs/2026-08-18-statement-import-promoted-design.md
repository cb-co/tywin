# Statement import, promoted (UX-02)

**Date:** 18 Aug 2026
**Audit item:** UX-02 · Fix · High — *"The best feature in the app is buried three levels deep"*
**Audit doc:** `docs/product-audit-dominican-market.md`

## Why

Statement import is the one feature that removes manual entry from a user's life, and it is reachable
from exactly one place: `StatementsPanel`, rendered at `app/(app)/accounts/[id]/page.tsx:458` behind
`isCardType`. A user must own a credit card, have added it with a limit, a closing day and a due day,
and have navigated into it before they can discover it. Onboarding never mentions it. Three Insights
empty states name it and link nowhere.

The audit's single north-star metric is *users who imported a statement in the last 35 days*. The
expensive half of that — extraction, PII scrubbing, the checksum guard, section mapping, merchant
rules — is already built and good. This item is discoverability and nothing else.

## Scope

In:

1. Split the import flow out of `StatementsPanel` into a dialog mountable anywhere.
2. Give the dialog the ability to resolve its own target account, including creating one.
3. A state-aware callout on Overview.
4. A permanent import action on Wallet.
5. The three Insights empty states become live entry points.
6. A skippable card step in onboarding.
7. Copy at en/es parity, and the help guide updated.

Out, with reasons in §9: bank-account statements (BUILD-02), post-import triage (UX-03 / BUILD-13),
scanned PDFs (UX-13), the activation metric, UX-11's pay-cycle onboarding question.

## 1 · Split the panel

`components/accounts/statements-panel.tsx` does two jobs in one file: the import flow (file → parse →
preview → confirm) and the statement history (past statements, expandable line detail, delete).

The import flow moves to `components/statements/statement-import-dialog.tsx`, self-contained, with a
controlled `open` prop so any screen can trigger it. `StatementsPanel` keeps the history list and
renders the dialog with its own `accountId` pinned — the card page's behaviour is unchanged from the
user's side.

The history list stays card-only. It is reference material for a card you already own, not an entry
point, and it has no meaning on Overview.

## 2 · The dialog resolves its own target

`parseStatement` and `confirmStatementImport` both require an `account_id`, and `loadAccountContext`
rejects anything that is not a credit card (`app/(app)/accounts/statement-actions.ts:74`). The dialog
takes an optional `accountId` and resolves the rest:

| Situation | What opens |
| --- | --- |
| `accountId` given (card page) | File picker |
| Exactly one credit card | File picker, card named in the header |
| Several credit cards | Card picker, then file picker |
| No credit cards | Card stub step (§3), then file picker |

The card list comes from the same `card_status` rows Overview already reads (§5) — the view left-joins
from `accounts where type = 'credit_card'`, so cards with no statements are present.

## 3 · The card stub

`refineAccount` (`lib/accounts/schema.ts:52`) requires `credit_limit`, `statement_closing_day` and
`payment_due_day` for credit cards. That rule is right for the full form and wrong for this path: it
puts a five-field form in front of the feature whose entire pitch is that it saves you typing.

The columns are already nullable, and `card_status` already tolerates a null limit — `utilization_pct`
returns null rather than dividing by it.

**A separate narrow validator**, `cardStubInput`, sits alongside `accountInput`: `name`, `currency`,
`last4`. It creates one credit-card account with the three card fields null. `accountInput` keeps its
strict rule, so the main account form is unaffected.

**The statement backfills what it knows.** On `confirmStatementImport`, for the target account only:

| Column | Source | Rule |
| --- | --- | --- |
| `statement_closing_day` | day-of-month of `periodEnd` | fill if null |
| `payment_due_day` | day-of-month of `dueDate` | fill if null, and `dueDate` is not null |
| `credit_limit` | `creditLimitCents / 100` | fill if null, and the issuer printed one |

All three are on the extractor's output already (`lib/statements/types.ts:20-30`). **Backfill only ever
fills a null.** It never overwrites a value the user set — a user who typed a limit of RD$100,000 keeps
it even if the statement disagrees, because the statement's figure can be a per-line limit on a
multi-line card.

## 4 · The group stub

`suggestAccountId` (`lib/statements/mapping.ts:10`) matches a section to a candidate account **by
currency**, returning `null` when no same-currency candidate exists. Candidates are the account itself,
or all its card-group siblings (`loadAccountContext`).

So a single DOP stub meeting a typical DR statement maps the DOP section, strands the USD section with
nowhere to go, and would put the installments section on the same account as ordinary spending —
losing exactly the separation BUILD-01 will need.

**Lazily, after the parse.** The stub is created ungrouped, as a plain card. Only the parse reveals how
many sections the statement has, so only then does the mapping step offer to create the missing lines
as further stubs — defaulting to `<Card> USD`, `<Card> Cuotas` — which promotes the card into a
`card_groups` row at that moment.

Creating a group up front for every stub would make this step trivial, but most Dominican cards are
single-currency DOP and should stay plain accounts rather than become one-line groups just in case.

`createCardWithLines` (`app/(app)/accounts/actions.ts:296`) cannot be reused: it validates every line
with strict `accountInput` and creates the group before the lines exist. This needs a sibling action
that takes stub input and attaches to a card that already exists.

**Promotion must re-key saved section mappings.** `statement_section_mappings` is keyed on
`card_group_id`, using a zero-UUID sentinel for ungrouped cards
(`app/(app)/accounts/statement-actions.ts:93`). Promoting a card without moving its rows from the
sentinel to the new group id leaves its remembered mappings silently unresolvable. A fresh stub has
none; a long-standing ungrouped card that turns out to have a USD section does.

## 5 · Overview callout

**No new query.** `getOverview` already selects `latest_period_end` from `card_status`
(`lib/overview/queries.ts:106-110`), added by migration `20260727140000_card_status_period_end.sql`.
The view left-joins statements onto accounts, so a card with no statement yields a null.

| State | Treatment |
| --- | --- |
| No cards, or no card has any statement | Loud callout: *"Importa tu estado de cuenta"* |
| Every card's newest `latest_period_end` is more than 35 days old | Overdue variant |
| Any card current within 35 days | Nothing |

35 days matches the audit's metric window and gives a monthly cycle a few days of slack. The callout
sits between the hero and the stat grid on Overview's populated state, and inside the existing empty
state for a user with nothing yet.

The point of the state-awareness is that the callout is absent for the users who have already formed
the habit — it costs them no space on the busiest screen — and present exactly when the next statement
is due.

## 6 · Wallet and Insights

**Wallet** (`app/(app)/accounts/page.tsx`): a permanent `Importar` action in the `PageHeader`. Always
available, low footprint, and the screen where someone thinking about their cards already is.

**Insights**: `costOfCarryEmpty`, `cashbackEmpty` and `cardFeesEmpty` (`messages/en.json:582,589,598`,
and their `es.json` counterparts) become buttons opening the dialog in place, rather than sentences
naming a feature the reader cannot reach. These are the audit's "six empty states"; there are three.

## 7 · Onboarding step 4

`STEP_COUNT` goes 3 → 4 in `components/onboarding/welcome-flow.tsx`. The new step is skippable:
*"¿Tienes tarjeta de crédito?"* → the §3 stub fields → offer the import dialog immediately.

The comment at `welcome-flow.tsx:25` argues against exactly this, on the grounds that cards need limits,
closing days, principals and terms, "which would turn a three-step welcome into a form". The stub is
what retires that objection — three light fields, with the statement filling the rest. Rewrite the
comment to state the stub-plus-backfill rule rather than the constraint it replaces; leaving it there
contradicting the code is worse than either.

A user who imports during onboarding reaches the dashboard with a populated app, which is the whole
argument for the step.

## 8 · Copy and help

New keys in `messages/en.json` and `messages/es.json` at parity: the callout in both states, the card
picker, the stub fields, the group-line prompt, and the onboarding step. Spanish is the primary
audience — write it first and translate to English, not the reverse.

Per the standing rule, the help guide is updated in the same change: `statementsBody` currently
describes import as something reached from a card's page, which stops being true.

## 9 · Deliberately out of scope

**BUILD-02, bank-account statements.** The `notACard` gate stays. The audit calls the card-only limit
"a product decision, not a technical one", which is half right: the entry point is a product decision,
but `card_statements` carries `statement_balance` and `due_date`, `card_status` is
`where a.type = 'credit_card'`, and balance anchoring assumes a statement cycle a checking account does
not have. Its own item, in the Next horizon.

**UX-03 / BUILD-13, triage and the rules screen.** Sequenced deliberately after this. Note honestly
that shipping UX-02 alone makes categorisation *worse* in the short run: more imports means more runs
of 80 uncategorised rows, each still one dialog at a time. UX-02 creates the pressure; UX-03 relieves
it.

**UX-13, scanned PDFs.** An image-only PDF still fails with "That file couldn't be read as a PDF".
Promoting import raises the traffic hitting that path, since first-time users are likelier to arrive
with a photographed statement. The natural follow-on after UX-03.

**The activation metric.** No analytics package exists in the repo. "Users who imported in the last 35
days" is a SQL query against `card_statements`, not a build item.

**UX-11's pay-cycle question.** Separate audit item; only the card step joins onboarding here.

**Untouched:** the extractor, PII scrubber, checksum guard, duplicate-section rejection and LLM
pipeline. This item adds no capability to the importer — it only changes who can find it.

## 10 · Testing

- `cardStubInput` accepts name/currency/last4 and rejects a bad `last4`; `accountInput` still rejects a
  credit card missing its limit, closing day or due day.
- Backfill fills a null column, and leaves a set one alone, for each of the three fields.
- Backfill with a null `dueDate` and a null `creditLimitCents` leaves those columns null.
- `suggestAccountId` against a stub group: DOP section maps, USD section returns null before the line
  exists and maps after it is created.
- Promotion re-keys `statement_section_mappings` from the sentinel to the new group id.
- Callout state: no cards → loud; card with no statement → loud; newest `latest_period_end` 40 days
  old → overdue; 10 days old → absent; several cards where one is current → absent.
- The dialog resolves to the file picker with one card, the picker with several, the stub with none.

## 11 · Risks

- **More imports, more uncategorised rows.** Accepted, and the argument for doing UX-03 next.
- **More scanned-PDF failures.** Accepted; the error message is honest even if unhelpful, and UX-13
  fixes it properly.
- **A stub card shows an empty limit** until a statement backfills it, so utilization reads as null on
  the card page. Correct behaviour — better than a fabricated limit — but it means a user who adds a
  stub and never imports has a slightly emptier card face than one who used the full form.
