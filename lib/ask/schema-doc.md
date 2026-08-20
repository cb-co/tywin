# The data you can query

You may query these four views and nothing else. They are already scoped to one
person — never filter by `user_id`, and never mention it.

## q_transactions

One row per transaction.

| column | meaning |
| --- | --- |
| `id`, `occurred_at`, `type` | `type` is `expense`, `income`, or `payment`. |
| `description`, `notes` | Free text. Merchant names live in `description`. |
| `account_id`, `account`, `account_type`, `account_brand`, `account_last4`, `bank` | The account the money moved from. `account_type` is `checking`, `savings`, `cash`, `investment`, `asset`, `credit_card`, or `loan`. |
| `to_account_id`, `to_account`, `to_account_type` | Set when this moved money to another of their own accounts. |
| `category_id`, `category`, `subscription_id`, `subscription` | `category` is null when the transaction has not been categorised yet. |
| `currency`, `amount`, `total_amount` | As charged. `total_amount` includes fees and tax. |
| `base_currency`, `base_amount`, `base_total_amount` | Converted to their base currency. |
| `budget_spend` | **Use this for "how much did I spend".** |
| `cash_out` | **Use this for "how much left my account".** |
| `cash_in` | Income. |
| `exclude_from_budget`, `fx_fallback`, `mcc` | `mcc` is the merchant category code, present only on imported statement rows. |

### budget_spend vs cash_out

These answer different questions and are both already correct — never build
either one yourself out of the raw amount columns.

`budget_spend` is what the app's budget and category screens count: expenses and
card payments, minus anything flagged as excluded. Use it for spending by
category, spending against a budget, "what did I spend on X".

`cash_out` is money that actually left an account. **A credit-card purchase is
borrowed, not spent cash**, so it is zero in `cash_out` and only counts when the
card is paid. Use it for cashflow, "how much did I actually pay out", runway.

Sum the column. Do not re-derive either rule.

## q_accounts

One row per account. To find an account someone names in words, match
case-insensitively across `name`, `brand`, and `last4` — "my Amex Platinum"
might be any of the three. Then filter `q_transactions` by the `id` you found.

Columns: `id`, `name`, `type`, `brand`, `last4`, `bank`, `card_group`,
`currency`, `is_archived`, `balance`, `starting_balance`, `current_balance`,
`credit_limit`, `owed`, `utilization_pct`, `latest_statement_balance`,
`latest_due_date`, `latest_period_end`, `statement_closing_day`,
`payment_due_day`, `interest_rate`, `outstanding_balance`,
`installment_amount`, `installments_paid`, `term_months`,
`original_term_months`, `principal`, `start_date`.

Card fields are null on non-cards; loan fields are null on non-loans.
`is_archived` accounts are closed — exclude them unless asked about history.

## q_card_statements

One row per statement period, per card. Read these rather than re-deriving them
from transactions.

Columns: `id`, `account_id`, `account`, `period_start`, `period_end`,
`due_date`, `statement_balance`, `minimum_payment`, `previous_balance`,
`total_debits`, `total_credits`, `cashback_total`, `interest_rate_annual`,
`avg_daily_balance`, `cost_of_carry`, `credit_limit`, `available_credit`,
`overdue_amount`, `source`.

## q_budgets

One row per month per budgeted category.

Columns: `month`, `category_id`, `category`, `budget`, `used`, `remaining`.
`month` is the first day of the month. A category with no budget set has no row.
