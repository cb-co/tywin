# Credit-Card Statement Import — Design

**Date:** 2026-07-22
**Status:** Approved direction, pending spec review
**Replaces:** manual card reconciliation (`ReconcilePanel`: hand-typed statement summaries + "set current balance owed")

## 1. Goal

Replace manual credit-card conciliation with statement-PDF import. The statement is the
**source of truth**: the app copies its balances and never derives what is owed by summing
lines. Uploading a monthly statement:

1. Records the statement (period, balances, totals, due date, cost of carry) per credit line.
2. Creates expense transactions for every purchase/fee/refund line, auto-categorized,
   feeding budgets, cashflow, and insights.
3. Skips payment lines entirely (model "A2") — payments are recorded manually by the user
   as `payment` transactions from a funding account, when they actually pay.
4. Anchors the card's live balance to the statement's closing balance ("anchor + drift").

Verified against two real statements:

| Issuer | Fingerprint | Layout traits |
|---|---|---|
| Banco Popular Dominicano (VISA) | RNC `101010632` | Single DOP line, MCC + auth code on continuation line, 23-digit acquirer refs, dates `dd/mm` (no year), amounts `-1,234.56` |
| Scotiabank RD (AMEX) | RNC `101-04359-8` | One card, **three credit lines** (DOP revolving, USD revolving, Cuotas DOP), no MCC, dates `dd/mm/yyyy`, trailing-dot amounts `1,234.56.`, card-suffix distinguishes purchases (`6760`) from bank entries (`1169`/`1177`) |

Both formats carry an internal checksum: `previous balance + debits − credits = closing
balance`, per section. Both tie to the cent on the sample files (42/42 and 23+11 lines
parsed). Parsing is therefore **deterministic** (regex over layout-preserved text) — no
LLM involved, no statement data leaves the app.

## 2. Core model

### 2.1 Anchor + drift

A statement gives a bank-certified pair `(period_end, statement closing balance)` per
credit line — the **anchor**. The card's live balance is:

```
current_balance = latest anchor balance
                + Σ payment transactions to this card, not budget_only,
                    occurred_at > anchor period_end
```

- Imported statement lines **never** affect the balance. They are dated inside the
  statement period, i.e. at or before the anchor; the bank already summed them.
- Manual payments dated after the anchor drift the balance down immediately.
- A new anchor absorbs all payments dated on/before its `period_end`; the drift sum
  restarts from the new anchor. No deletion, no double-count, idempotent re-import.
- Transaction dates: the **date made** (`FECHAS DE TRANSAC.` / `FECHA DE TRANS.`) is
  `occurred_at` and what the user sees; the posting date is stored for reference only.
- If a card has no statement yet, the anchor is `(−∞, 0)` and the formula degrades to
  "0 − payments", which the first import corrects.

Implementation: replace the incremental `transactions_sync_card_balance` trigger logic
with a recompute function `recompute_card_balance(account_id)` that applies the formula
above and writes `accounts.current_balance`. It runs on: statement insert/update/delete
for the account, and payment insert/update/delete targeting the account. Recompute (not
increment) makes late-entered or deleted payments and re-imports converge to the same
number. `card_status`, `net_worth`, and the UI keep reading `accounts.current_balance`
unchanged.

### 2.2 One file → many statements (section mapping)

A parser splits a PDF into **sections**, one per credit line, each with a stable
`section_key` derived from the statement's own structure:

- `popular_visa` → single section `DOP`
- `scotia_amex` → `DOP`, `USD`, `CUOTAS_DOP`

Routing a section to an `accounts` row:

1. The file's card last4 resolves the `card_group` (or a solo card account).
2. If the group has exactly one credit-card account and the file one section → auto-map.
3. Otherwise look up `statement_section_mappings (parser_id, card_group_id, section_key)
   → account_id`. Missing mappings trigger a one-time mapping dialog, pre-filled by
   heuristics (currency match, nearest credit limit). Heuristics only pre-fill; the user
   confirms. Confirmed mappings persist; later imports are zero-touch. A new section key
   from the bank prompts for just that section.

Upload can start from any account page in the group; sections fan out to all mapped
accounts regardless of the entry point.

### 2.3 Payments vs purchases vs credits

Per-parser classification of lines:

- **Payment lines — skipped** (stored as audit lines per §3.3, but generate no
  transaction): Popular `Pago via SPE` (short numeric ref, no MCC); Scotia
  `PAGOS TARJETAS ACH` / `PAGOS TARJETAS INTERNET` / `PAGO VENTANILLA` (bank-entry card
  suffix). They are baked into the closing balance; the user records the real transfer
  themselves.
- **Purchases and fees — imported** as `expense` transactions (fees like
  `CARGO SOBREGIRO`, `CARGO SEGURO FRAUDE` categorized by rule, default "Other").
- **Merchant credits — imported with negative amount**: rebates, refunds, reversals
  (`Rebate VISA ISI`, `REVERSO…`, negative merchant lines). They reduce category spend in
  the month they occur. Requires relaxing `transactions.amount >= 0` for
  statement-sourced expense rows (see §3.4).

## 3. Data model

### 3.1 New: `statement_imports` (the uploaded file)

```
id uuid pk, user_id, parser_id text, card_group_id uuid null,
file_name text, file_path text null (private Storage bucket),
status enum: parsed_ok | failed_detection | failed_validation | imported,
error text null, created_at
```

The original PDF is stored as uploaded (still encrypted if it was) in a private,
RLS-scoped Supabase Storage bucket `statements/` under `user_id/…`. PDF passwords are
used in memory for text extraction and **never persisted**; re-parsing requires re-entry.

> **Amended 2026-07-22 (post-merge):** the app no longer stores the original
> PDF at all — it's read once for text extraction and discarded. Statement
> history offers expandable line detail (§6.1) instead of a stored-PDF link.
> The `statements` Storage bucket, its RLS policies, and any files in it were
> dropped entirely (manually, then via migration) since nothing writes to it
> anymore.

### 3.2 Extended: `card_statements`

Add columns:

```
import_id uuid null references statement_imports on delete set null,
section_key text null,
previous_balance numeric, minimum_payment numeric, overdue_amount numeric,
overdue_installments int,
credit_limit numeric, available_credit numeric,
interest_rate_annual numeric,             -- 40.00, 60.00
avg_daily_balance numeric,                -- current-month capital
avg_daily_balance_prior numeric,
cost_of_carry numeric,                    -- "interés si opta por financiar" / "intereses nuevos consumos"
cost_of_carry_prior numeric,              -- financed interest on prior months' capital
unique (account_id, period_end)
```

`unique (account_id, period_end)` makes import idempotent: re-importing a period
**replaces** that statement (delete + reinsert statement, lines, and their generated
transactions in one server-side transaction). Existing columns (`statement_balance`,
`total_balance`, `total_debits`, `total_credits`, `due_date`, `source`, `file_url`) keep
their meaning; imported rows use `source = 'import'`. Legacy `manual` rows remain valid
anchors.

Period rule: `period_end` = fecha de corte. `period_start` = day after the previous
cutoff (`period_end − 1 month + 1 day`) when the statement doesn't state it. Popular's
year-less `dd/mm` dates take the cutoff's year, minus one year when the date's month is
later than the cutoff month (Dec/Jan wrap).

### 3.3 New: `card_statement_lines` (raw parsed lines, audit trail)

```
id uuid pk, user_id, statement_id uuid references card_statements on delete cascade,
account_id uuid, line_no int,
made_on date not null, posted_on date not null,
reference text null, description text not null, mcc text null, auth_code text null,
amount numeric not null,                  -- negative = credit
kind enum: purchase | fee | credit | payment,
transaction_id uuid null references transactions on delete set null,
unique (statement_id, line_no)
```

Payment lines are stored here (`kind = 'payment'`, for display/audit) but generate **no**
transaction. All other kinds generate exactly one `expense` transaction.

### 3.4 Extended: `transactions`

```
statement_line_id uuid null references card_statement_lines on delete cascade
```

- Amount check relaxed to: `amount >= 0 or statement_line_id is not null`.
- Generated rows: `type='expense'`, `account_id` = card account, `currency` = account
  currency, `occurred_at` = `made_on`, `description` = cleaned merchant text,
  `category_id` from categorization (§5), `exchange_rate` = FX rate to base at import
  time via `lib/fx.ts` (1 if same as base), `include_tax/commission = false`.
- `budget_only` is always **false** on imported rows: they must appear in monthly
  cashflow (this is the first time card spend becomes visible there — payments are
  transfers and correctly never counted as cashflow expense).
- Net-worth semantics, pinned: credit cards contribute to net worth **only** as the
  liability `−accounts.current_balance` (anchor + drift). Imported expense rows never
  reach net worth — `account_balances` excludes credit-card accounts — because the
  anchor already contains every purchase; counting both would double-count. This
  existing exclusion is load-bearing and must not be relaxed.
- UI: statement-generated transactions are read-only except `category_id` and `notes`
  (recategorizing must stay possible); amount/date/account edits are blocked because the
  statement owns them. Deleting them individually is blocked; deleting the statement
  removes them via cascade and triggers balance recompute.

### 3.5 New: `statement_section_mappings`

```
id uuid pk, user_id, parser_id text, card_group_id uuid references card_groups on delete cascade,
section_key text, account_id uuid references accounts on delete cascade,
unique (user_id, parser_id, card_group_id, section_key)
```

### 3.6 New: `category_rules`

```
id uuid pk, user_id, rule_type enum: mcc | merchant,
pattern text,                -- '5812' | 'UBER EATS'
category_id uuid references categories on delete cascade,
priority int, unique (user_id, rule_type, pattern)
```

All tables: owner-only RLS (same four-policy pattern as existing tables), `set_updated_at`
triggers where mutable.

### 3.7 Changed: `category_usage` — card payments stop counting toward budgets

Today `category_usage` counts categorized rows of `type in ('expense','payment')`. The
user's pre-import workflow budgeted through categorized payments to cards ("fuel budget →
categorized payment to the fuel card"). With imported statement lines carrying the real
categories, a categorized card payment would deduct the same budget twice.

Change: `category_usage` excludes `payment` rows whose `to_account_id` is a
**credit-card** account. Payments to loans (and any other destination) remain budgetable —
that use is legitimate and unaffected. Old categorized card payments become inert against
budgets without data migration; the transaction form stops offering a category when the
payment destination is a credit card.

## 4. Parsing pipeline

```
upload (+ optional password)
  → extract layout text (pdfjs-dist in a Node server action; password in memory only)
  → detect parser by fingerprint (RNC / bank name in text); unknown → failed_detection,
    friendly "this bank isn't supported yet" with the fingerprint logged
  → parser emits sections: {section_key, currency, period, totals, cost-of-carry fields,
    lines[{dates, reference?, description, mcc?, auth?, amount, kind}]}
  → validate per section: previous_balance + Σdebits − Σcredits == closing balance
    (exact, after payment lines are included in the sums — the checksum uses ALL lines)
  → any section fails → status failed_validation, NOTHING is written, error shows the
    per-section computed vs stated numbers
  → resolve card group by last4 → resolve mappings (§2.2; dialog if incomplete)
  → preview: per section — account, period, closing balance, N transactions to import,
    M payment lines skipped, cost of carry → user confirms
  → atomic write: import row, statements (replacing same account+period), lines,
    transactions, recompute balances, upload file to Storage
```

Parser architecture: `lib/statements/parsers/<parser_id>.ts` implementing
`{ id, detect(text): boolean, parse(text): ParsedStatement }`, registered in
`lib/statements/registry.ts`. Two parsers ship initially: `popular_visa`, `scotia_amex`.
Adding a bank = adding one file + fixtures.

Testing: unit fixtures are **synthetic** text files replicating each layout (including
the checksum property, multi-page repetition, Dec/Jan wrap, refunds, trailing-dot
amounts). Real statements are never committed. `.gitignore` gains `*.pdf`.

## 5. Auto-categorization

Order per line: merchant rule match (substring, case-insensitive, highest priority
first) → MCC rule match → seeded "Other".

Seed default MCC rules on first use (user-editable afterwards), mapped to the seeded
categories: 5411/5499 → Groceries; 5812/5813/5814 → Dining; 5541/4111/9399 (tolls) →
Transport; 5311/5999 → Shopping; 5912/8011/8099 → Health; 5921 → Entertainment;
7832/5815-5818 → Entertainment; fallback → Other. Scotia (no MCC) relies on merchant
rules; recategorizing a Scotia line offers "always categorize <merchant> like this",
which writes a merchant rule.

## 6. UI changes

### 6.1 Card page (`app/(app)/accounts/[id]`)

- **Remove** `ReconcilePanel` entirely: the "current balance owed" manual setter
  (`setCardBalance`) and the hand-typed statement form (`addCardStatement`) are gone,
  along with their server actions and translations.
- **Add `StatementsPanel`:**
  - "Import statement" button → file picker (+password prompt when the PDF is
    encrypted) → mapping dialog when needed → preview → confirm.
  - **Statement history list** for this credit line: one row per statement — period,
    closing balance, due date, minimum payment, cost of carry, source badge
    (imported/manual-legacy), link to the stored PDF, expandable line detail, delete
    (with confirmation; cascades lines + transactions, recomputes balance).
  - **Cost-of-carry stat** from the latest statement: financed-interest amount, APR,
    average daily balance ("carrying this balance costs ≈ X/month at Y%"). Hidden when
    the parser found no such data.
- Balance header shows the anchor provenance: "as of <period_end> statement, plus
  payments since".

### 6.2 Insights

New "Cost of carry" section: per credit line (card group → line label), latest
statement's cost of carry, APR, and average daily balance, converted to base currency via
`lib/fx.ts` for the total row, native currency shown per line. Backed by a
`card_cost_of_carry` view (latest statement per credit-card account, lateral join —
same shape as `card_status`).

### 6.3 Transactions list

Statement-sourced rows get a small "statement" badge; editing restrictions per §3.4.

All new strings go through `next-intl` (`messages/en.json`, `messages/es.json`).

## 7. Error handling

| Failure | Behavior |
|---|---|
| Wrong/missing PDF password | Inline prompt, retry; nothing written |
| Unknown bank layout | `failed_detection`; nothing written; fingerprint logged |
| Checksum mismatch in any section | `failed_validation`; **nothing written in any section**; error shows computed vs stated per section |
| Last4 matches no account/group | Prompt user to pick the card group (saved like a mapping) |
| Unmapped sections | Mapping dialog; import proceeds only when all sections are mapped |
| Re-upload of same period | Replaces that period's statement + lines + transactions atomically |
| FX rate unavailable at import | Import proceeds with rate 1 and a visible warning on affected transactions (consistent with existing fx fallback behavior) |

## 8. Out of scope (deliberate)

- Matching statement lines against manually entered transactions (rejected: model A).
- Importing payment lines as transfers (rejected: A2).
- LLM-based extraction, OCR/scanned statements.
- Automatic statement retrieval from bank email.
- Historical backfill tooling beyond "upload old statements one by one" (which works,
  since anchors are keyed by period).

## 9. Open follow-ups (not blockers)

- Legacy `card_statements` rows without `previous_balance` etc. simply render fewer
  fields in history.
- `statement_source` enum already has `import`; no enum change needed.
- Removing the incremental card-balance trigger touches behavior of existing payment
  edit/delete flows — covered by recompute tests.
