import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { CardFace } from "@/components/papel/card-face";
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
  accounts,
  baseCurrency,
}: {
  name: string;
  brand: string | null;
  artColor: string | null;
  accounts: AccountWithStatus[];
  /** Decides which line the tile itself opens — see `primary` below. */
  baseCurrency: string;
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
  // The line the tile as a whole opens. A solo card tile is one link to one
  // account and this one has to behave the same way, so it needs a default —
  // and the default anybody means is the line they actually spend on, which is
  // the one in their own currency. Falls back to the first line for a card with
  // no base-currency line at all (a USD-only pair of revolving + installments).
  const primary = accounts.find((a) => a.currency === baseCurrency) ?? accounts[0];
  // The face carries no figure at all now, which also retires the cross-currency
  // question this used to have to answer: a group is usually a USD line plus a
  // DOP line on one physical card, there is no FX conversion here to unify them,
  // and the per-line rows below already report each one in its own currency.
  return (
    /* `relative` + `lift` so the whole tile is one clickable surface, exactly
       like AccountCard's — which is a `<Link>` wrapping its whole Card. It
       cannot be a wrapping link here, because the currency rows below are links
       too and an anchor inside an anchor is invalid. The stretched overlay
       below does the same job: it covers the tile, the rows sit above it, so
       the face and the padding open the primary line while each row still opens
       its own. */
    <Card className="lift relative h-full gap-0 p-5">
      {/* Positioned, so it paints over the static face beneath it; the rows are
          positioned too and carry a higher z-index, which is what keeps them
          clickable through it. The card's name is the accessible name — an
          overlay with no text is an unlabelled link to a screen reader. */}
      <Link
        href={`/accounts/${primary.id}`}
        aria-label={name}
        className="absolute inset-0 z-0 rounded-2xl"
      />
      {/* `pointer-events-none` so clicks and the pointer cursor fall through to
          the overlay above. The face's root is `relative`, and a positioned
          element paints over a z-0 one that precedes it in the DOM — so without
          this it sat on top of the link, swallowing the hover and leaving the
          default arrow over the one part of the tile that looks most clickable.
          It is pure decoration here; the tile it sits in owns the navigation. */}
      <CardFace
        name={name}
        last4={resolvedLast4}
        network={network}
        accent={artColor}
        className="pointer-events-none"
      />
      <div className="relative z-10 mt-4 divide-y">
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
