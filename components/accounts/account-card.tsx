import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatPercent, formatDayOfMonth } from "@/lib/format";
import { accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import type { AccountWithStatus } from "@/lib/accounts/queries";
import { cn } from "@/lib/utils";

function utilizationTone(pct: number) {
  if (pct >= 80) return "text-destructive";
  if (pct >= 50) return "text-warning";
  return "text-muted-foreground";
}

export function AccountCard({ account }: { account: AccountWithStatus }) {
  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const Icon = meta.icon;
  const currency = account.currency;

  return (
    <Link href={`/accounts/${account.id}`} className="group block">
      <Card className="h-full gap-0 p-5 transition-colors group-hover:border-primary/40">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: account.color
                  ? `color-mix(in oklab, ${account.color} 16%, transparent)`
                  : "var(--accent)",
                color: account.color ?? "var(--accent-foreground)",
              }}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{account.name}</p>
              <p className="text-xs text-muted-foreground">
                {meta.label} · {currency}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </div>

        {type === "credit_card" ? (
          <CardBody
            owed={account.cardStatus?.owed ?? account.current_balance}
            limit={account.cardStatus?.credit_limit ?? account.credit_limit ?? null}
            util={account.cardStatus?.utilization_pct ?? null}
            dueDay={account.payment_due_day}
            currency={currency}
          />
        ) : type === "loan" ? (
          <LoanBody
            outstanding={account.loanStatus?.outstanding_balance ?? account.principal ?? 0}
            paid={account.loanStatus?.installments_paid ?? 0}
            term={account.term_months}
            installment={account.installment_amount}
            currency={currency}
          />
        ) : (
          <div className="mt-5">
            <p className="figure text-2xl leading-none text-foreground">
              {formatMoney(account.balance ?? account.starting_balance, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Current balance</p>
          </div>
        )}
      </Card>
    </Link>
  );
}

function CardBody({
  owed,
  limit,
  util,
  dueDay,
  currency,
}: {
  owed: number;
  limit: number | null;
  util: number | null;
  dueDay: number | null;
  currency: string;
}) {
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="figure text-2xl leading-none text-foreground">{formatMoney(owed, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Owed</p>
        </div>
        {util !== null ? (
          <span className={cn("text-sm font-medium", utilizationTone(util))}>
            {formatPercent(util)}
          </span>
        ) : null}
      </div>
      {util !== null ? <Progress value={Math.min(util, 100)} /> : null}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{limit ? `Limit ${formatMoney(limit, currency)}` : "No limit set"}</span>
        {dueDay ? <span>Due the {formatDayOfMonth(dueDay)}</span> : null}
      </div>
    </div>
  );
}

function LoanBody({
  outstanding,
  paid,
  term,
  installment,
  currency,
}: {
  outstanding: number;
  paid: number;
  term: number | null;
  installment: number | null;
  currency: string;
}) {
  const pct = term && term > 0 ? Math.min((paid / term) * 100, 100) : 0;
  return (
    <div className="mt-5 space-y-3">
      <div>
        <p className="figure text-2xl leading-none text-foreground">{formatMoney(outstanding, currency)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Outstanding</p>
      </div>
      {term ? <Progress value={pct} /> : null}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{term ? `${paid} / ${term} paid` : `${paid} paid`}</span>
        {installment ? <span>{formatMoney(installment, currency)}/mo</span> : null}
      </div>
    </div>
  );
}
