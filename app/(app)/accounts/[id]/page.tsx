import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  getAccountById,
  getCurrencies,
  getCardGroups,
  getBanks,
  getCardStatements,
} from "@/lib/accounts/queries";
import { getAccountTransactions, getQuickAddData } from "@/lib/transactions/queries";
import { AccountActivity } from "@/components/accounts/account-activity";
import { BalanceChart } from "@/components/accounts/balance-chart";
import { createClient } from "@/lib/supabase/server";
import { accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import { formatMoney, formatPercent, formatDayOfMonth } from "@/lib/format";
import { AccountDetailActions } from "@/components/accounts/account-detail-actions";
import { StatementsPanel } from "@/components/accounts/statements-panel";
import { AmortizationTable } from "@/components/accounts/amortization-table";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, currencies, cardGroups, banks, activity, quickAddData, statements] =
    await Promise.all([
      getAccountById(id),
      getCurrencies(),
      getCardGroups(),
      getBanks(),
      getAccountTransactions(id),
      getQuickAddData(),
      getCardStatements(id),
    ]);
  if (!account) notFound();

  const t = await getTranslations("AccountDetail");
  const tType = await getTranslations("AccountTypes");

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
  // Raw count of payments logged in Cashly — drives the forward-looking amortization
  // schedule below, which always starts fresh from `term_months` (remaining) at entry.
  const paid = account.loanStatus?.installments_paid ?? 0;
  // Display-only progress: credits installments assumed paid before tracking started
  // (via original_term_months) plus `paid`. Falls back to `paid`/`term_months` when
  // original_term_months isn't set.
  const progressPaid = account.loanStatus?.progress_installments_paid ?? paid;
  const progressTerm = account.loanStatus?.progress_term_months ?? account.term_months;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backLink")}
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {account.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tType(type)} · {currency}
              {account.is_archived ? ` · ${t("archived")}` : ""}
            </p>
          </div>
        </div>
        <AccountDetailActions
          account={account}
          currencies={currencies}
          cardGroups={cardGroups}
          banks={banks}
          baseCurrency={baseCurrency}
        />
      </div>

      {/* Hero figure */}
      <Card className="p-7">
        {isCardType ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">{t("balanceOwed")}</p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(owed, currency)}
            </p>
            {statements[0] ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("anchoredToStatement", { date: statements[0].period_end })}
              </p>
            ) : null}
            {util !== null ? (
              <div className="mt-4 max-w-sm space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("utilization")}</span>
                  <span>{formatPercent(util)}</span>
                </div>
                <Progress value={Math.min(util, 100)} />
              </div>
            ) : null}
            {account.payment_due_day ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("paymentDueEachMonth", { day: formatDayOfMonth(account.payment_due_day) })}
              </p>
            ) : null}
          </>
        ) : isLoanType ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">{t("outstandingBalance")}</p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(outstanding, currency)}
            </p>
            {progressTerm ? (
              <div className="mt-4 max-w-sm space-y-2">
                <Progress value={Math.min((progressPaid / progressTerm) * 100, 100)} />
                <p className="text-sm text-muted-foreground">
                  {t("installmentsPaidOfTerm", { paid: progressPaid, term: progressTerm })}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("installmentsPaidOnly", { paid: progressPaid })}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              {type === "asset" ? t("estimatedValue") : t("currentBalance")}
            </p>
            <p className="figure mt-2 text-4xl leading-none text-foreground">
              {formatMoney(account.balance ?? account.starting_balance, currency)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("derivedFromStarting", { amount: formatMoney(account.starting_balance, currency) })}
            </p>
          </>
        )}
      </Card>

      {!isCardType && !isLoanType ? (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium text-foreground">{t("balanceOverTime")}</h2>
          <BalanceChart
            accountId={account.id}
            startingBalance={account.starting_balance}
            currency={currency}
            transactions={activity}
          />
        </Card>
      ) : null}

      {isCardType ? (
        <StatementsPanel accountId={account.id} currency={currency} statements={statements} />
      ) : null}

      {isLoanType ? (
        <Card className="p-6">
          <h2 className="text-lg font-medium">{t("amortizationSchedule")}</h2>
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

      {/* Fee settings summary. Hidden for credit cards: card spending arrives
          via statement import, and transfer fees never apply to it. */}
      {!isCardType ? (
      <Card className="p-6">
        <h2 className="text-lg font-medium">{t("transferFees")}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("taxRate")}</dt>
            <dd className="tabular-nums">{formatPercent(account.transfer_tax_rate * 100)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("networkFee")}</dt>
            <dd className="tabular-nums">{formatMoney(account.network_fee_amount, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("feeIs")}</dt>
            <dd>{account.network_fee_optional ? t("optional") : t("obligatory")}</dd>
          </div>
        </dl>
      </Card>
      ) : null}

      <AccountActivity accountId={account.id} transactions={activity} data={quickAddData} />
    </div>
  );
}
