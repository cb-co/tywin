import Link from "next/link";
import { useTranslations } from "next-intl";
import { ImportButton } from "@/components/statements/import-button";
import { formatDate, formatMoney } from "@/lib/format";
import type { DebtCost, DebtCostRow } from "@/lib/insights/debt-cost";

function Rows({ rows, locale }: { rows: DebtCostRow[]; locale: string }) {
  const t = useTranslations("Insights");
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <Link
          key={r.accountId}
          href={`/accounts/${r.accountId}`}
          className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">
              {r.currency} · {r.apr !== null ? `${t("costOfCarryApr", { rate: r.apr })} · ` : ""}
              {t("costOfCarryAsOf", { date: formatDate(r.asOf, locale) })}
            </p>
          </div>
          <span className="shrink-0 tabular-nums text-foreground">{formatMoney(r.amount, r.currency)}</span>
        </Link>
      ))}
    </div>
  );
}

function Subtotal({ label, amount, muted }: { label: string; amount: string; muted?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{amount}</span>
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
    <div className="space-y-6">
      {data.cards.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("debtCostCards")}
          </h4>
          <Rows rows={data.cards} locale={locale} />
          <div className="border-t pt-3">
            <Subtotal
              label={t("debtCostCardsMonthly", { currency: cur })}
              amount={formatMoney(data.cardsMonthlyBase, cur)}
            />
          </div>
        </section>
      ) : null}
      {data.loans.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("debtCostLoans")}
          </h4>
          <Rows rows={data.loans} locale={locale} />
          {/* "Recorded in", not "Paid in": payments made before the loan was
              added to the app were never transactions, so the year figure
              counts the tracked part of the year, not the year. */}
          <div className="space-y-1.5 border-t pt-3">
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
