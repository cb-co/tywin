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
 *
 * Note the asymmetry: art and network belong to the group, digits belong to the
 * lines. That is not an inconsistency — the group is where you choose how the
 * card LOOKS, and there is a form for it; the digits are a property of the
 * physical card that every line already reports, so storing them a second time
 * on the group only created a value with no way to edit it.
 */
export function CardGroupTile({
  name,
  brand,
  artColor,
  holder,
  accounts,
}: {
  name: string;
  brand: string | null;
  artColor: string | null;
  holder: string;
  accounts: AccountWithStatus[];
}) {
  const t = useTranslations("Accounts");
  const network = inferNetwork(name, brand);
  // The digits come from the LINES, not from the group. A group has no digits of
  // its own to edit — it is an arrangement of currency lines of one physical
  // card, and every one of those lines carries the same four digits. Taking the
  // first line that resolves means the value follows whatever the person set on
  // the account, with the group's own name as a last resort for groups whose
  // lines are all named without digits.
  const resolvedLast4 =
    accounts.map((a) => inferLast4(a.name, a.last4)).find((v) => v !== null) ??
    inferLast4(name);
  // The face carries no figure at all now, which also retires the cross-currency
  // question this used to have to answer: a group is usually a USD line plus a
  // DOP line on one physical card, there is no FX conversion here to unify them,
  // and the per-line rows below already report each one in its own currency.
  return (
    <Card className="h-full gap-0 p-5">
      <PaymentCard
        holder={holder}
        last4={resolvedLast4}
        network={network}
        color={artColor}
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
