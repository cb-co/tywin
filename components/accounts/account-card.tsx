import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Perforation } from "@/components/papel/perforation";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { CardFace } from "@/components/papel/card-face";
import { ProofMark } from "@/components/papel/proof-mark";
import { inferNetwork, inferLast4 } from "@/lib/accounts/network";
import { formatMoney, formatPercent, formatDayOfMonth } from "@/lib/format";
import { accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import type { AccountWithStatus } from "@/lib/accounts/queries";
import { MaskedMoney } from "@/components/figure-mask/masked-money";

export function AccountCard({
  account,
}: {
  account: AccountWithStatus;
}) {
  const t = useTranslations("Accounts");
  const tType = useTranslations("AccountTypes");
  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const Icon = meta.icon;
  const currency = account.currency;
  // A card belonging to a group is rendered by the gallery's CardGroupTile —
  // its face lives there, once per physical card. Rendering a second face
  // here would double-count it.
  const isStandaloneCard = type === "credit_card" && !account.card_group_id;

  return (
    <Link href={`/accounts/${account.id}`} className="group block">
      {/* Cards carry a soft shadow rather than a ring, so the hover has to
          deepen the shadow — `group-hover:ring-*` was styling an edge that
          isn't drawn. */}
      <Card className="h-full gap-0 p-5 transition-shadow group-hover:shadow-(--shadow-card-hover)">
        {isStandaloneCard ? (
          <CardFace
            name={account.name}
            last4={inferLast4(account.name, account.last4)}
            network={inferNetwork(account.name, account.brand)}
            accent={account.color}
          />
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Stamp color={account.color ?? meta.color} icon={Icon} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tType(type)} · {currency}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
        )}

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
            paid={account.loanStatus?.progress_installments_paid ?? account.loanStatus?.installments_paid ?? 0}
            term={account.loanStatus?.progress_term_months ?? account.term_months}
            installment={account.installment_amount}
            currency={currency}
          />
        ) : (
          <div className="mt-5">
            {/* Same figure treatment as a card group's currency lines
                (card-group-tile) — de-emphasised cents, at the tile's own
                stat scale rather than their inline one, since here it is the
                headline rather than one row of several. */}
            <p className="leading-none">
              <MoneyDisplay
                amount={account.balance ?? account.starting_balance}
                currency={currency}
                size="stat"
              />
            </p>
            {/* An asset's figure is an estimate you set by hand, not a balance
                derived from transactions. Calling it a balance overstates how
                much the number can be trusted. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {type === "asset" ? t("estimatedValue") : t("currentBalance")}
            </p>
            {account.committed > 0 && (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {t.rich("availableCommitted", {
                  available: () => <MaskedMoney amount={account.available} currency={currency} />,
                  committed: () => <MaskedMoney amount={account.committed} currency={currency} />,
                })}
              </p>
            )}
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
  const t = useTranslations("Accounts");
  return (
    <div className="mt-5 space-y-3">
      {/* The face above carries no figure, so this block is the only place the
          owed amount appears on a card tile. */}
      <div className="flex items-end justify-between">
        <div>
          <p className="leading-none">
            <MoneyDisplay amount={owed} currency={currency} size="stat" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("owed")}</p>
        </div>
        {util !== null ? (
          <ProofMark tone={util >= 80 ? "flag" : "neutral"} className="text-sm">
            {formatPercent(util)}
          </ProofMark>
        ) : null}
      </div>
      {util !== null ? <Progress value={Math.min(Math.max(util, 0), 100)} /> : null}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{limit ? t("limitAmount", { amount: formatMoney(limit, currency) }) : t("noLimitSet")}</span>
        {dueDay ? <span>{t("dueThe", { day: formatDayOfMonth(dueDay) })}</span> : null}
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
  const t = useTranslations("Accounts");
  return (
    <div className="mt-5 space-y-3">
      <div>
        <p className="leading-none">
          <MoneyDisplay amount={outstanding} currency={currency} size="stat" />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("outstanding")}</p>
      </div>
      {term ? (
        <Perforation total={term} paid={paid} label={t("paidOfTerm", { paid, term })} decorative />
      ) : null}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{term ? t("paidOfTerm", { paid, term }) : t("paidOnly", { paid })}</span>
        {installment ? <span>{t("perMonth", { amount: formatMoney(installment, currency) })}</span> : null}
      </div>
    </div>
  );
}
