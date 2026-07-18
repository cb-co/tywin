import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { getAccountById, getCurrencies, getCardGroups } from "@/lib/accounts/queries";
import { createClient } from "@/lib/supabase/server";
import { accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import { formatMoney, formatPercent, formatDayOfMonth } from "@/lib/format";
import { AccountDetailActions } from "@/components/accounts/account-detail-actions";
import { ReconcilePanel } from "@/components/accounts/reconcile-panel";
import { AmortizationTable } from "@/components/accounts/amortization-table";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, currencies, cardGroups] = await Promise.all([
    getAccountById(id),
    getCurrencies(),
    getCardGroups(),
  ]);
  if (!account) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = profile?.base_currency ?? "USD";

  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const Icon = meta.icon;
  const currency = account.currency;
  const isCardType = type === "credit_card";
  const isLoanType = type === "loan";

  const owed = account.cardStatus?.owed ?? account.current_balance;
  const util = account.cardStatus?.utilization_pct ?? null;
  const outstanding = account.loanStatus?.outstanding_balance ?? account.principal ?? 0;
  const paid = account.loanStatus?.installments_paid ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Accounts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center rounded-xl"
            style={{
              backgroundColor: account.color
                ? `color-mix(in oklab, ${account.color} 16%, transparent)`
                : "var(--accent)",
              color: account.color ?? "var(--accent-foreground)",
            }}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              {account.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {meta.label} · {currency}
              {account.is_archived ? " · Archived" : ""}
            </p>
          </div>
        </div>
        <AccountDetailActions
          account={account}
          currencies={currencies}
          cardGroups={cardGroups}
          baseCurrency={baseCurrency}
        />
      </div>

      {/* Hero figure */}
      <Card className="p-7">
        {isCardType ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">Balance owed</p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(owed, currency)}
            </p>
            {util !== null ? (
              <div className="mt-4 max-w-sm space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Utilization</span>
                  <span>{formatPercent(util)}</span>
                </div>
                <Progress value={Math.min(util, 100)} />
              </div>
            ) : null}
            {account.payment_due_day ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Payment due the {formatDayOfMonth(account.payment_due_day)} each month.
              </p>
            ) : null}
          </>
        ) : isLoanType ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">Outstanding balance</p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(outstanding, currency)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {account.term_months ? `${paid} of ${account.term_months} installments paid` : `${paid} installments paid`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">Current balance</p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(account.balance ?? account.starting_balance, currency)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Derived from a starting balance of {formatMoney(account.starting_balance, currency)}.
            </p>
          </>
        )}
      </Card>

      {isCardType ? (
        <ReconcilePanel
          accountId={account.id}
          currency={currency}
          currentBalance={account.current_balance}
          latestStatementBalance={account.cardStatus?.latest_statement_balance ?? null}
          latestDueDate={account.cardStatus?.latest_due_date ?? null}
        />
      ) : null}

      {isLoanType ? (
        <Card className="p-6">
          <h2 className="font-serif text-lg font-medium">Amortization schedule</h2>
          <div className="mt-4">
            <AmortizationTable
              principal={account.principal ?? 0}
              annualRate={account.interest_rate ?? 0}
              termMonths={account.term_months ?? 0}
              installment={account.installment_amount}
              currency={currency}
              installmentsPaid={paid}
            />
          </div>
        </Card>
      ) : null}

      {/* Fee settings summary */}
      <Card className="p-6">
        <h2 className="font-serif text-lg font-medium">Transfer fees</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Tax rate</dt>
            <dd className="tabular-nums">{formatPercent(account.transfer_tax_rate * 100)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Network fee</dt>
            <dd className="tabular-nums">{formatMoney(account.network_fee_amount, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fee is</dt>
            <dd>{account.network_fee_optional ? "Optional" : "Obligatory"}</dd>
          </div>
        </dl>
      </Card>

      {/* Transactions history — arrives in Phase 4 */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Recent activity</h2>
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title="No activity yet"
          description="Transactions for this account will appear here once Quick-Add ships in the next phase."
        />
      </div>
    </div>
  );
}
