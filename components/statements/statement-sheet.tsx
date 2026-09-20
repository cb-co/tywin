import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SheetRow } from "@/lib/statements/sheet-rows";

/** A statement read line by line: ruled paper, the bank's own text, the
 *  amount at the right, credits as a plus. Rows carry `--i` so the global
 *  `.sheet-row` motion can stagger them. */
export function StatementSheet({
  rows,
  more,
  currency,
}: {
  rows: SheetRow[];
  more: number;
  currency: string;
}) {
  const t = useTranslations("Statements");
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <ol aria-label={t("sheetLabel")} className="border-y border-(--paper-line)">
        {rows.map((r, i) => (
          <li
            key={r.key}
            style={{ "--i": i } as React.CSSProperties}
            className="sheet-row grid grid-cols-[2.6rem_1fr_auto] items-baseline gap-2 border-b border-(--paper-line) px-1 py-1.5 text-xs last:border-b-0"
          >
            <span className="figure text-muted-foreground">{r.date}</span>
            <span className="truncate uppercase tracking-wide">{r.text}</span>
            <span className={cn("figure font-semibold", r.credit && "text-(--teal)")}>
              {r.credit ? "+" : ""}
              {formatMoney(r.amount, currency)}
            </span>
          </li>
        ))}
      </ol>
      {more > 0 ? <p className="mt-1 text-xs text-muted-foreground">{t("sheetMore", { count: more })}</p> : null}
    </div>
  );
}

/** Unprinted ruled paper while the file is being read. The rows are empty
 *  rules with one sweeping highlight, never placeholder figures. */
export function ReadingSheet({ fileName }: { fileName: string }) {
  const t = useTranslations("Statements");
  return (
    <div className="min-w-0 space-y-2" role="status">
      <p className="truncate text-sm font-medium">{t("readingSheet", { fileName })}</p>
      <div aria-hidden className="border-y border-(--paper-line)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-7 rounded-none border-b border-(--paper-line) last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
