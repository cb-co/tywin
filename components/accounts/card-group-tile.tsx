import Link from "next/link";
import { CreditCard, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/lib/format";
import type { AccountWithStatus } from "@/lib/accounts/queries";

/** Two or more currency lines of one physical card, rendered as a single tile. */
export function CardGroupTile({
  name,
  accounts,
}: {
  name: string;
  accounts: AccountWithStatus[];
}) {
  return (
    <Card className="h-full gap-0 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CreditCard className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{accounts.length} currency lines</p>
        </div>
      </div>
      <div className="mt-3 divide-y">
        {accounts.map((a) => {
          const owed = a.cardStatus?.owed ?? a.current_balance;
          const util = a.cardStatus?.utilization_pct ?? null;
          return (
            <Link
              key={a.id}
              href={`/accounts/${a.id}`}
              className="group flex items-center justify-between py-3 first:pt-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{a.currency}</p>
                {util !== null ? (
                  <p className="text-xs text-muted-foreground">{formatPercent(util)} used</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="figure text-base text-foreground">{formatMoney(owed, a.currency)}</span>
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
