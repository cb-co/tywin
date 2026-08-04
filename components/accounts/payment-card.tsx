import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoneyDisplay } from "@/components/ui/money-display";
import { NetworkMark } from "./network-mark";
import { readableForeground, gradientFrom } from "@/lib/color";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * A credit card rendered as the physical object.
 *
 * Aspect ratio is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm), the real card shape.
 *
 * The foreground is MEASURED from the resolved fill rather than assumed white:
 * the fill can come from a user-chosen account colour, and white on a pale
 * yellow card is unreadable.
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
  owed: number;
  currency: string;
  href?: string;
  className?: string;
}) {
  const t = useTranslations("Accounts");
  const fill = color ?? "#4326C9";
  const fg = readableForeground(fill);

  const body = (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold opacity-90">{name}</p>
        <NetworkMark network={network} className="shrink-0 opacity-90" />
      </div>

      <p className="font-mono text-base tracking-[0.18em] opacity-85">
        {`•••• •••• •••• ${last4 ?? "••••"}`}
      </p>

      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-70">{t("owed")}</p>
        <MoneyDisplay amount={owed} currency={currency} size="stat" />
      </div>
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
