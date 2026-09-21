import { useTranslations } from "next-intl";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ProofMark } from "@/components/papel/proof-mark";
import { RuleMeter } from "@/components/papel/rule-meter";
import { formatPercent } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function DebtHealth({
  utilization,
  loans,
}: {
  utilization: Insights["utilization"];
  loans: Insights["loans"];
}) {
  const t = useTranslations("Insights");
  if (utilization.length === 0 && loans.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("debtHealthEmpty")}</p>;
  }

  return (
    <div className="-mx-4 -mb-4 space-y-5 pb-2">
      {utilization.length > 0 ? (
        <div>
          <p className="legend px-4 pb-2 text-[11px] text-muted-foreground">{t("cardUtilizationLabel")}</p>
          <div className="border-t border-(--paper-line)">
            {utilization.map((c) => (
              <LedgerBlock
                key={c.id}
                head={<LedgerRow title={`${c.name} · ${c.currency}`} meta={formatPercent(c.pct)} />}
              >
                <RuleMeter used={c.pct} total={100} label={c.name} near={c.pct >= 50} />
                {c.pct >= 80 ? <ProofMark tone="flag">{t("utilizationHigh")}</ProofMark> : null}
              </LedgerBlock>
            ))}
          </div>
        </div>
      ) : null}
      {loans.length > 0 ? (
        <div>
          <p className="legend px-4 pb-2 text-[11px] text-muted-foreground">{t("loanPayoffLabel")}</p>
          <div className="border-t border-(--paper-line)">
            {loans.map((l) => (
              <LedgerBlock
                key={l.id}
                head={<LedgerRow title={`${l.name} · ${l.currency}`} meta={formatPercent(l.paidPct)} />}
              >
                <RuleMeter used={l.paidPct} total={100} label={l.name} />
              </LedgerBlock>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
