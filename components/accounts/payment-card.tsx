import Link from "next/link";
import { NetworkMark } from "./network-mark";
import { readableForeground, gradientFrom } from "@/lib/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@/lib/accounts/card-art";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * The contactless-payment glyph, top-left on every card.
 *
 * Three dots rather than the real arcs: the arc mark is EMV's trademark and
 * printing it on a card that may not support contactless would be a claim about
 * the card rather than decoration. The dots read as the same corner furniture
 * without asserting a capability.
 */
function CornerDots() {
  return (
    <svg viewBox="0 0 26 6" aria-hidden className="h-1.5 w-auto opacity-60">
      <circle cx="3" cy="3" r="3" fill="currentColor" />
      <circle cx="13" cy="3" r="3" fill="currentColor" />
      <circle cx="23" cy="3" r="3" fill="currentColor" />
    </svg>
  );
}

/**
 * The masked number: three groups of asterisks, then the real last four.
 *
 * Asterisks rather than bullets because that is what the reference sets, and
 * they read as redaction where bullets read as a password field. They sit high
 * on the em square in every font we ship, so the groups are nudged down to
 * optically centre them against the digits — without that they float above the
 * baseline and the row looks broken.
 *
 * The digits are set slightly larger and untracked so the one piece of real
 * information on the row is the one the eye lands on.
 */
function CardNumber({ last4 }: { last4: string | null }) {
  return (
    <p className="flex items-center gap-[0.55em] font-mono text-sm">
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative top-[0.16em] tracking-[0.22em]">
          ****
        </span>
      ))}
      <span className="text-base tracking-[0.12em]">{last4 ?? "****"}</span>
    </p>
  );
}

/**
 * A credit card rendered as the physical object.
 *
 * Aspect ratio is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm) and the corner radius is
 * the real one — under 4% of the long edge. Both matter: get either wrong and
 * the silhouette stops reading as a card no matter what is printed on it.
 *
 * The face carries identity only — holder, masked number, network, colour. It
 * deliberately shows NO balance. A real card does not print one, and the tile
 * around this component already reports the figures underneath, per currency
 * line, where they can be masked and labelled properly.
 *
 * The foreground is MEASURED from the resolved fill rather than assumed white:
 * the accent can come from card-art inference or from stored user data, and
 * white on a pale gold card is unreadable.
 */
export function PaymentCard({
  holder,
  last4,
  network,
  color,
  href,
  className,
}: {
  /** The cardholder, as embossed. Falls back when the profile has no name. */
  holder: string;
  last4: string | null;
  network: CardNetwork | null;
  color: string | null;
  href?: string;
  className?: string;
}) {
  // A stored colour is arbitrary user data — validate its shape before it
  // reaches colour maths that assumes a 6-digit hex. A 3- or 8-digit value
  // would misparse and yield a foreground measured against the wrong colour.
  const fill = color && HEX6.test(color) ? color : DEFAULT_CARD_ACCENT;
  const fg = readableForeground(fill);

  const body = (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[0.75rem] p-5 shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      <div className="flex items-start justify-between gap-3">
        <CornerDots />
        <NetworkMark network={network} fill={fill} className="shrink-0" />
      </div>

      <div className="space-y-1.5">
        <p className="truncate text-[0.95rem] leading-none">{holder}</p>
        <CardNumber last4={last4} />
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
