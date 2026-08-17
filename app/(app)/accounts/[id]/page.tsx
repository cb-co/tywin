import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import {
  getAccountById,
  getCurrencies,
  getCardGroups,
  getBanks,
  getCardStatements,
  getCardGroupSiblings,
  getCardGroupLines,
  getCardSpendByCategory,
  getAccountFeeLines,
} from "@/lib/accounts/queries";
import { spendTotal } from "@/lib/accounts/card-spend";
import { monthStart, monthLabel } from "@/lib/budgets/month";
import { SpendDonut } from "@/components/insights/lazy-charts";
import { resolveEffectiveBonus, getWelcomeBonusSpend } from "@/lib/accounts/welcome-bonus";
import { yearCashback, hasReportedCashback } from "@/lib/accounts/cashback";
import { summarizeCardFees } from "@/lib/accounts/card-fees";
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
import { CardLineRail } from "@/components/accounts/card-line-rail";
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
  const [
    account,
    currencies,
    cardGroups,
    banks,
    activity,
    quickAddData,
    statements,
    siblings,
    cardLines,
  ] = await Promise.all([
    getAccountById(id),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
    getAccountTransactions(id),
    getQuickAddData(),
    getCardStatements(id),
    getCardGroupSiblings(id),
    getCardGroupLines(id),
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

  /* Cashback earned this calendar year, summed off the statements already
   * loaded above — the anchor rows themselves, so no extra round trip and no
   * second source of truth to disagree with the statements panel. */
  const cashbackYear = new Date().getFullYear();
  const cashbackTotal = isCardType ? yearCashback(statements, cashbackYear) : 0;
  const cashbackReported = isCardType && hasReportedCashback(statements, cashbackYear);

  /* Where this month's charges went, by category. A second round trip rather
   * than a member of the Promise.all above, because it is only worth issuing
   * once `type` says this account is a card — and `type` comes out of that very
   * batch. The same shape the Insights donut is fed, so the ring below is
   * literally that component rather than a near-copy of it.
   *
   * Calendar month, not the statement period: it is the window every other
   * spending figure in the app is framed by (the donut, the budget bars, the
   * pace chart), and a card whose statement closes mid-month would otherwise
   * report a category total that agreed with nothing else on screen. */
  const spendMonth = monthStart();
  const spendSlices = isCardType
    ? await getCardSpendByCategory(id, spendMonth, t("uncategorized"))
    : [];
  const spendMonthTotal = spendTotal(spendSlices);

  /* What this card charges you to hold it, this calendar year. A second round
   * trip for the same reason getCardSpendByCategory is one: the fee lines live
   * in card_statement_lines, which this page does not otherwise load, and the
   * query is only worth issuing once `type` says this account is a card.
   *
   * Costs only — never netted against the cashback line above it. Most of a
   * card's benefits never appear on a statement, so a net figure would be
   * built from the costs the app can see and a blank where the benefits are. */
  const feeYear = new Date().getFullYear();
  const cardFees = isCardType
    ? summarizeCardFees(await getAccountFeeLines(id, feeYear), feeYear)
    : { recurring: 0, incidents: 0, counted: 0 };

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
      {/* The back row names the physical card when this account is one line of
          one. A person arriving here from a notification or a link has no other
          way to tell that the account they are reading shares plastic with
          another — the face alone cannot say it, because a solo card draws a
          face too.

          The group is a static crumb, not a link: there is no card-group page
          to send anyone to. Its lines are what you can navigate to, and the rail
          in the hero below does that. */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backLink")}
        </Link>
        {cardGroup ? (
          <>
            <ChevronRight aria-hidden className="size-3.5 text-muted-foreground/50" />
            <span className="truncate text-foreground">{cardGroup.name}</span>
          </>
        ) : null}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          {/* Every account is titled the same way: tile, then name. The tile
              used to stand down on cards, to avoid competing with the face
              drawn directly beneath it — but the face now lives inside the
              hero card, a panel away, so the two no longer read as duplicate
              portraits of the same object stacked on top of each other. The
              tile is the account's identity in the header row (it is what the
              accounts grid uses); the face is the physical card. */}
          <ColorTile color={account.color ?? meta.color} icon={Icon} size="md" />
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
          banks={banks}
          baseCurrency={baseCurrency}
          effectiveBonus={effectiveBonus}
          // Newest first — the same row the hero's "As of the … statement" line reads.
          anchoredTo={statements[0]?.period_end ?? null}
        />
      </div>

      {/* Hero figure. The clamp() font-size is text-4xl on anything ≥ ~424px
          but scales down on narrow phones so 8-9 digit balances (large ARS
          statements) don't get clipped by the card's overflow-hidden.

          Two columns, face then figures. The face used to sit alone above this
          panel, which left it orphaned — a picture with nothing to do, while
          the panel that carried every number about the card showed no sign of
          which card it was. Pairing them makes one object: this card, these
          balances.

          NEITHER column shrinks. The face is pinned at its natural 22rem
          (max-w-full only so a phone narrower than that clamps it instead of
          overflowing), and the figures column holds a floor of the SAME 22rem
          wherever a face is drawn — two equal halves, so the panel splits down
          the middle instead of the figures crowding up against the card. With
          no face there is no width to match, and the floor drops to 16rem.
          When the two can no longer both fit, flex-wrap drops the figures
          beneath the face rather than squeezing either — a squeezed face stops
          reading as a card, and squeezed figures wrap mid-number.

          The floor is min(22rem,100%), not a bare 22rem: min-width beats
          max-width in the cascade, so a flat floor wider than a small phone's
          viewport would push the panel into a horizontal scroll that nothing
          downstream could clamp. */}
      <Card className="p-7">
        <div className="flex flex-wrap items-center gap-8">
          {face ? (
            /* The face and its rail move as one block. Wrapping them means the
               rail inherits the face's exact width and wraps with it, instead
               of being a third flex child that could end up beside the figures
               when the panel reflows. */
            <div className="w-88 max-w-full shrink-0">
              <PaymentCard {...face} />
              <CardLineRail lines={cardLines} />
            </div>
          ) : null}
          <div className={`flex-1 ${face ? "min-w-[min(22rem,100%)]" : "min-w-[16rem]"}`}>
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
                {/* No max-w-sm on the card's meters, unlike the loan's below.
                    The cap was sized for a hero that ran the panel's full
                    52rem, where a bar spanning the whole measure would have
                    looked like a loading indicator. The column is ~28rem now
                    that the face sits beside it, already close to that cap, so
                    the only thing the cap still does is strand ~4rem at the
                    right of every meter. */}
                {util !== null ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("utilization")}</span>
                      <span>{formatPercent(util)}</span>
                    </div>
                    <Progress value={Math.min(Math.max(util, 0), 100)} />
                  </div>
                ) : null}
                {showBonus ? (
                  <div className="mt-4 space-y-2">
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
                {/* Cashback earned this year. A line rather than a card of its own:
                    it is one number, and it belongs to this card, so it reads best
                    sitting with the card's other standing facts.

                    Shown only once a statement has actually REPORTED a figure —
                    statements imported before the field existed carry null, and a
                    confident "RD$0.00 cashback" drawn from silence would be a
                    claim the data can't support. */}
                {cashbackReported ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.rich("cashbackThisYear", {
                      // String, not the number: ICU formats a numeric argument
                      // through Intl.NumberFormat, which would print "2,026".
                      year: String(cashbackYear),
                      amount: () => (
                        <span className="figure font-medium text-foreground">
                          {formatMoney(cashbackTotal, currency)}
                        </span>
                      ),
                    })}
                  </p>
                ) : null}
                {/* Standing facts about the card, in the same register as the
                    cashback line above: one number each, sitting with the
                    card's other facts rather than in a card of their own.

                    Each line appears only when its own subtotal is non-zero. A
                    card with no fee lines shows neither — silence rather than a
                    confident "RD$0.00 in fees", which would be a claim drawn
                    from the absence of data rather than from data.

                    A subtotal can go negative: summarizeCardFees nets reversals
                    in with plain addition, so a card whose only counted row
                    this year is a reversal of a PRIOR year's charge yields a
                    negative bucket. `formatMoney` would print a bare minus sign
                    under a "charged" heading, which reads backwards — so the
                    sign picks the label ("refunded") instead, and the number
                    always shows the magnitude. Same convention as the Insights
                    cost-of-ownership card (app/(app)/insights/page.tsx). */}
                {cardFees.recurring !== 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.rich(
                      cardFees.recurring < 0
                        ? "costOfOwnershipRefundedThisYear"
                        : "costOfOwnershipThisYear",
                      {
                        year: String(feeYear),
                        amount: () => (
                          <span className="figure font-medium text-foreground">
                            {formatMoney(Math.abs(cardFees.recurring), currency)}
                          </span>
                        ),
                      },
                    )}
                  </p>
                ) : null}
                {cardFees.incidents !== 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.rich(
                      cardFees.incidents < 0
                        ? "incidentFeesRefundedThisYear"
                        : "incidentFeesThisYear",
                      {
                        year: String(feeYear),
                        amount: () => (
                          <span className="figure font-medium text-foreground">
                            {formatMoney(Math.abs(cardFees.incidents), currency)}
                          </span>
                        ),
                      },
                    )}
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
          </div>
        </div>
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

      {/* Spend by category, this month. Sits between the hero and the
          statements panel because that is the order the page reads in: what the
          card is worth now, what it was used for lately, then the statement
          record, then the individual charges.

          Rendered even with nothing to show — the donut draws its own empty
          line — so a card that has simply not been used yet still says so,
          rather than the section silently vanishing and leaving the reader to
          wonder whether the page failed to load it. */}
      {isCardType ? (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium text-foreground">
            {t("spendByCategory", { month: monthLabel(spendMonth, locale) })}
          </h2>
          {/* Native currency, never converted: every charge here posted to this
              one account. See lib/accounts/card-spend.ts. */}
          <SpendDonut data={spendSlices} total={spendMonthTotal} currency={currency} />
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
