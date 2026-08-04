import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { PaymentCard } from "./payment-card";
import { inferNetwork, inferLast4 } from "@/lib/accounts/network";
import { formatPercent } from "@/lib/format";
import type { AccountWithStatus } from "@/lib/accounts/queries";

/**
 * Two or more currency lines of one physical card, rendered as a single tile.
 *
 * The card group IS the physical card, so the face — the art, the network
 * mark, the last four digits — renders exactly once here. The currency lines
 * beneath it are rows on the same card, not separate cards.
 */
export function CardGroupTile({
  name,
  brand,
  last4,
  artColor,
  accounts,
}: {
  name: string;
  brand: string | null;
  last4: string | null;
  artColor: string | null;
  accounts: AccountWithStatus[];
}) {
  const t = useTranslations("Accounts");
  const network = inferNetwork(name, brand);
  const resolvedLast4 = inferLast4(name, last4);
  // Card groups are usually cross-currency (e.g. a USD line and a DOP line on
  // the same physical card), and there is no FX conversion here to unify
  // them. The face shows one summed figure only when every line agrees on a
  // currency; otherwise it shows no figure at all rather than a number that
  // silently mixes units. `lineCurrencies` (a Set, not `accounts[0]`) is what
  // decides this, so an empty `accounts` array can never produce a bogus
  // "uniform" currency.
  const lineCurrencies = new Set(accounts.map((a) => a.currency));
  const uniformCurrency = lineCurrencies.size === 1 ? [...lineCurrencies][0] : undefined;
  const owed = accounts.reduce((sum, a) => sum + (a.cardStatus?.owed ?? a.current_balance), 0);

  return (
    <Card className="h-full gap-0 p-5">
      <PaymentCard
        name={name}
        last4={resolvedLast4}
        network={network}
        color={artColor}
        owed={uniformCurrency !== undefined ? owed : undefined}
        currency={uniformCurrency}
      />
      <div className="mt-4 divide-y">
        {accounts.map((a) => {
          const lineOwed = a.cardStatus?.owed ?? a.current_balance;
          const util = a.cardStatus?.utilization_pct ?? null;
          return (
            <Link
              key={a.id}
              href={`/accounts/${a.id}`}
              className="group flex items-center justify-between py-3 first:pt-2"
            >
              <div>
                {/* Name, not currency, is the headline: a card can carry two lines in
                    the same currency (e.g. revolving DOP + installments DOP). The
                    currency still needs to be visible, so it rides along in the
                    muted line below. */}
                <p className="text-sm font-medium text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {util !== null ? t("usedPercent", { pct: formatPercent(util), currency: a.currency }) : a.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MoneyDisplay amount={lineOwed} currency={a.currency} size="inline" />
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
