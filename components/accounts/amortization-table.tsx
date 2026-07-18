import { Check } from "lucide-react";
import { buildSchedule } from "@/lib/accounts/amortization";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AmortizationTable({
  principal,
  annualRate,
  termMonths,
  installment,
  currency,
  installmentsPaid,
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  installment: number | null;
  currency: string;
  installmentsPaid: number;
}) {
  const rows = buildSchedule({ principal, annualRate, termMonths, installment });
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a principal, rate, and term to see the amortization schedule.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="w-10 py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Payment</th>
            <th className="py-2 pr-4 font-medium">Interest</th>
            <th className="py-2 pr-4 font-medium">Principal</th>
            <th className="py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const paid = row.n <= installmentsPaid;
            return (
              <tr key={row.n} className={cn(paid && "text-muted-foreground")}>
                <td className="py-2 pr-3 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    {paid ? <Check className="size-3 text-success" /> : null}
                    {row.n}
                  </span>
                </td>
                <td className="py-2 pr-4 tabular-nums">{formatMoney(row.payment, currency)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatMoney(row.interest, currency)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatMoney(row.principal, currency)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(row.balance, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
