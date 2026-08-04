import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoneyDisplay } from "@/components/ui/money-display";
import { NetworkMark } from "./network-mark";
import { readableForeground, gradientFrom } from "@/lib/color";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/** A 6-digit hex, the only shape `gradientFrom`/`readableForeground` parse correctly. */
const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * A credit card rendered as the physical object.
 *
 * Aspect ratio is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm), the real card shape.
 *
 * The foreground is MEASURED from the resolved fill rather than assumed white:
 * the fill can come from a user-chosen account colour, and white on a pale
 * yellow card is unreadable.
 *
 * `owed`/`currency` are optional: a card group whose lines don't all share one
 * currency has no single figure to show (no FX unification — see
 * card-group-tile.tsx), so the caller omits both rather than passing a
 * sentinel like `0` or `""`.
 */
export function PaymentCard({
  name,
  last4,
  network,
  color,
  owed,
  currency,
  href,
  className,
}: {
  name: string;
  last4: string | null;
  network: CardNetwork | null;
  color: string | null;
  owed?: number;
  currency?: string;
  href?: string;
  className?: string;
}) {
  const t = useTranslations("Accounts");
  // A stored colour is arbitrary user data — validate its shape before it
  // reaches colour maths that assumes a 6-digit hex. A 3- or 8-digit value
  // would misparse and yield a foreground measured against the wrong colour.
  // Toned well down from the old #4326C9, which was the hero gradient's end
  // stop — full brand chroma read as a novelty purple on an object that is
  // meant to look issued rather than designed. Same hue, roughly half the
  // chroma, so it still belongs to the palette without shouting.
  const fill = color && HEX6.test(color) ? color : "#494B9A";
  const fg = readableForeground(fill);

  const body = (
    <div
      className={cn(
        // A real ID-1 card's corner radius is 3.18mm on an 85.6mm width — under
        // 4% of the long edge. The app's own rounded-3xl is 44px, which at these
        // sizes is nearer a squircle than a card and was the main reason the
        // silhouette did not read. A fixed 12px is right at every width for the
        // same reason it is right on the physical object: the radius is an
        // absolute size, not a proportion of how large the card is displayed.
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[0.75rem] p-5 shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold opacity-90">{name}</p>
        <NetworkMark network={network} fill={fill} className="shrink-0 opacity-90" />
      </div>

      <p className="font-mono text-base tracking-[0.18em] opacity-85">
        {`•••• •••• •••• ${last4 ?? "••••"}`}
      </p>

      {owed !== undefined && currency !== undefined ? (
        <div>
          <p className="text-[11px] uppercase tracking-wide opacity-70">{t("owed")}</p>
          <MoneyDisplay amount={owed} currency={currency} size="stat" />
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="lift block">
      {body}
    </Link>
  ) : (
    body
  );
}
