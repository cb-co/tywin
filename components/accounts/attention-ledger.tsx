import { useTranslations, useLocale } from "next-intl";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ProofMark } from "@/components/papel/proof-mark";
import { Stamp } from "@/components/papel/stamp";
import { formatDate } from "@/lib/format";
import type { AttentionItem } from "@/lib/accounts/attention";

/**
 * What needs a decision before anything else on the page: overdue, due
 * soon, or still carrying uncategorised spend. Renders nothing at all,
 * including no heading, when there is nothing to flag — a quiet month must
 * read as calm, not as a section that failed to load.
 */
export function AttentionLedger({ items }: { items: AttentionItem[] }) {
  const t = useTranslations("Accounts");
  const locale = useLocale();
  if (items.length === 0) return null;

  return (
    <section className="space-y-1">
      <h2 className="legend text-[11px] text-muted-foreground">{t("attentionTitle")}</h2>
      <div className="rounded-[4px] border border-(--paper-line)">
        {items.map((item) => (
          <LedgerRow
            key={item.id}
            lead={<Stamp color={item.color} name={item.name} size="sm" />}
            title={item.name}
            amount={
              <ProofMark tone="flag">
                {item.reason === "overdue"
                  ? t("attentionOverdue")
                  : item.reason === "due-soon" && item.dueDate
                    ? t("attentionDueSoon", { date: formatDate(item.dueDate, locale) })
                    : t("attentionUntriaged", { count: item.pendingTriageCount })}
              </ProofMark>
            }
          />
        ))}
      </div>
    </section>
  );
}
