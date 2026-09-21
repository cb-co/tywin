import Link from "next/link";
import { useTranslations } from "next-intl";
import { DoubleRule } from "@/components/papel/double-rule";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ImportButton } from "@/components/statements/import-button";
import { formatDate, formatMoney } from "@/lib/format";
import type { DebtCost, DebtCostRow } from "@/lib/insights/debt-cost";

function Rows({ rows, locale }: { rows: DebtCostRow[]; locale: string }) {
  const t = useTranslations("Insights");
  return (
    <div className="border-t border-(--paper-line)">
      {rows.map((r) => (
        <Link
          key={r.accountId}
          href={`/accounts/${r.accountId}`}
          className="block transition-colors hover:bg-muted/50"
        >
          <LedgerRow
            title={r.name}
            subtitle={`${r.currency} · ${r.apr !== null ? `${t("costOfCarryApr", { rate: r.apr })} · ` : ""}${t("costOfCarryAsOf", { date: formatDate(r.asOf, locale) })}`}
            amount={formatMoney(r.amount, r.currency)}
          />
        </Link>
      ))}
    </div>
  );
}

function Subtotal({ label, amount, muted }: { label: string; amount: string; muted?: boolean }) {
  return (
    <div
      className={`figure flex items-baseline justify-between gap-3 px-4 text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}
    >
      <span>{label}</span>
      <span>{amount}</span>
    </div>
  );
}

/**
 * Two groups, never one total. Card carry is what financing WOULD cost; loan
 * interest is what was paid. See buildDebtCost.
 *
 * Every row links to its account — the card's Boleta, or the loan's schedule —
 * which is where the rest of that debt's story lives now that Insights keeps
 * only the answer to "what is it costing me".
 */
export function DebtCostList({ data, locale }: { data: DebtCost; locale: string }) {
  const t = useTranslations("Insights");
  const cur = data.baseCurrency;

  if (data.cards.length === 0 && data.loans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("debtCostEmpty")}</p>
        <ImportButton size="sm" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -mb-4 space-y-6 pb-4">
      {data.cards.length > 0 ? (
        <section className="space-y-3">
          <h4 className="legend px-4 text-[11px] text-muted-foreground">
            {t("debtCostCards")}
          </h4>
          <Rows rows={data.cards} locale={locale} />
          <div className="space-y-3">
            <DoubleRule className="mx-4" />
            <Subtotal
              label={t("debtCostCardsMonthly", { currency: cur })}
              amount={formatMoney(data.cardsMonthlyBase, cur)}
            />
          </div>
        </section>
      ) : null}
      {data.loans.length > 0 ? (
        <section className="space-y-3">
          <h4 className="legend px-4 text-[11px] text-muted-foreground">
            {t("debtCostLoans")}
          </h4>
          <Rows rows={data.loans} locale={locale} />
          {/* "Recorded in", not "Paid in": payments made before the loan was
              added to the app were never transactions, so the year figure
              counts the tracked part of the year, not the year. */}
          <div className="space-y-1.5">
            <DoubleRule className="mx-4 mb-1.5" />
            <Subtotal
              label={t("loanInterestMonthly", { currency: cur })}
              amount={formatMoney(data.loansMonthlyBase, cur)}
            />
            <Subtotal
              muted
              label={t("loanInterestRecorded", { year: String(data.year), currency: cur })}
              amount={formatMoney(data.loansYearBase, cur)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
