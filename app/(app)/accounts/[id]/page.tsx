import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import {
  getAccountById,
  getCurrencies,
  getCardGroups,
  getBanks,
  getCardStatements,
  getCardGroupSiblings,
} from "@/lib/accounts/queries";
import { resolveEffectiveBonus, getWelcomeBonusSpend } from "@/lib/accounts/welcome-bonus";
import { getAccountTransactions, getQuickAddData } from "@/lib/transactions/queries";
import { AccountActivity } from "@/components/accounts/account-activity";
import { BalanceChart } from "@/components/accounts/balance-chart-lazy";
import { createClient } from "@/lib/supabase/server";
import { accountTypeMeta, hasTransferFees, type AccountType } from "@/lib/accounts/meta";
import { formatMoney, formatPercent, formatDayOfMonth, formatDate } from "@/lib/format";
import { AccountDetailActions } from "@/components/accounts/account-detail-actions";
import { StatementsPanel } from "@/components/accounts/statements-panel";
import { AmortizationTable } from "@/components/accounts/amortization-table";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";
import { PaymentCard } from "@/components/accounts/payment-card";
import { inferNetwork, inferLast4 } from "@/lib/accounts/network";
import { profileLabel } from "@/lib/profile";
import { Progress } from "@/components/ui/progress";
import { MaskedMoney } from "@/components/figure-mask/masked-money";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, currencies, cardGroups, banks, activity, quickAddData, statements, siblings] =
    await Promise.all([
      getAccountById(id),
      getCurrencies(),
      getCardGroups(),
      getBanks(),
      getAccountTransactions(id),
      getQuickAddData(),
      getCardStatements(id),
      getCardGroupSiblings(id),
    ]);
  if (!account) notFound();

  const t = await getTranslations("AccountDetail");
  const locale = await getLocale();
  const tType = await getTranslations("AccountTypes");

  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("base_currency, display_name").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const baseCurrency = profile?.base_currency ?? "USD";

  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const Icon = meta.icon;
  const currency = account.currency;
  const isCardType = type === "credit_card";
  const isLoanType = type === "loan";

  /* The face of the physical card this page is about.
   *
   * It was only ever on the accounts grid, which left the detail page — the one
   * screen wholly about this card — identifying it with the same generic tile a
   * chequing account gets. The face is how a person recognises which card they
   * are looking at, so it belongs here more than anywhere.
   *
   * A card that belongs to a GROUP takes the group's art and name: the group is
   * the physical card, and its currency lines are what this page can be one of.
   * Reading the account's own colour there would draw a face nobody holds.
   */
  const cardGroup = account.card_group_id
    ? (cardGroups.find((g) => g.id === account.card_group_id) ?? null)
    : null;
  const face = isCardType
    ? {
        holder: profileLabel(profile?.display_name, auth.user?.email) || t("cardholder"),
        last4: inferLast4(account.name, account.last4),
        network: inferNetwork(cardGroup?.name ?? account.name, cardGroup?.brand ?? account.brand),
        color: cardGroup ? cardGroup.art_color : account.color,
      }
    : null;

  const effectiveBonus = isCardType ? resolveEffectiveBonus(id, siblings) : null;
  const dueDatePassed = effectiveBonus ? effectiveBonus.welcome_bonus_due_date! < todayISO() : true;
  const showBonus = !!effectiveBonus && !dueDatePassed;
  const bonusSpent = showBonus
    ? await getWelcomeBonusSpend(supabase, siblings, effectiveBonus!.welcome_bonus_goal_currency!, effectiveBonus!.welcome_bonus_due_date!)
    : 0;
  const bonusPct = showBonus ? (bonusSpent / effectiveBonus!.welcome_bonus_goal_amount!) * 100 : 0;

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
          {/* The tile stands down where a face is drawn below — two portraits of
              the same object, one of them generic, and the generic one wins the
              eye by sitting first. Non-card accounts keep it. */}
          {face ? null : <ColorTile color={account.color} icon={Icon} size="md" />}
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
          effectiveBonus={effectiveBonus}
        />
      </div>

      {/* Not wrapped in a Card: the face carries its own shadow and radius, and
          putting it on a panel reads as a picture OF a card rather than as the
          card. It caps its own width, so it sits left rather than stretching. */}
      {face ? <PaymentCard {...face} className="mx-0" /> : null}

      {/* Hero figure. The clamp() font-size is text-4xl on anything ≥ ~424px
          but scales down on narrow phones so 8-9 digit balances (large ARS
          statements) don't get clipped by the card's overflow-hidden. */}
      <Card className="p-7">
        {isCardType ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">{t("balanceOwed")}</p>
            <p className="figure mt-2 text-[clamp(1.625rem,8.5vw,2.25rem)] font-semibold leading-none text-foreground">
              {formatMoney(owed, currency)}
            </p>
            {statements[0] ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("anchoredToStatement", { date: formatDate(statements[0].period_end, locale) })}
              </p>
            ) : null}
            {util !== null ? (
              <div className="mt-4 max-w-sm space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("utilization")}</span>
                  <span>{formatPercent(util)}</span>
                </div>
                <Progress value={Math.min(Math.max(util, 0), 100)} />
              </div>
            ) : null}
            {showBonus ? (
              <div className="mt-4 max-w-sm space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("welcomeBonusProgress")}</span>
                  <span>{formatPercent(bonusPct)}</span>
                </div>
                <Progress value={Math.min(Math.max(bonusPct, 0), 100)} />
                <p className="text-xs text-muted-foreground">
                  {t("welcomeBonusDetail", {
                    spent: formatMoney(bonusSpent, effectiveBonus!.welcome_bonus_goal_currency!),
                    goal: formatMoney(effectiveBonus!.welcome_bonus_goal_amount!, effectiveBonus!.welcome_bonus_goal_currency!),
                    date: formatDate(effectiveBonus!.welcome_bonus_due_date!, locale),
                  })}
                </p>
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
            <p className="figure mt-2 text-[clamp(1.625rem,8.5vw,2.25rem)] font-semibold leading-none text-foreground">
              {formatMoney(outstanding, currency)}
            </p>
            {progressTerm ? (
              <div className="mt-4 max-w-sm space-y-2">
                <Progress value={Math.min(Math.max((progressPaid / progressTerm) * 100, 0), 100)} />
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
            <p className="figure mt-2 text-[clamp(1.625rem,8.5vw,2.25rem)] font-semibold leading-none text-foreground">
              <MaskedMoney amount={account.balance ?? account.starting_balance} currency={currency} />
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t.rich("derivedFromStarting", {
                amount: () => <MaskedMoney amount={account.starting_balance} currency={currency} />,
              })}
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

      {/* Fee settings summary. Only bank and investment accounts can carry a
          transfer tax or network fee — hidden everywhere else (cards, loans,
          cash, assets). */}
      {hasTransferFees(type) ? (
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
