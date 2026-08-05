import Link from "next/link";
import { NetworkMark } from "./network-mark";
import { cardForeground, gradientFrom } from "@/lib/color";
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
    <svg viewBox="0 0 26 6" aria-hidden className="h-[1.8cqw] w-auto opacity-60">
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
    <p className="flex items-center gap-[0.55em] font-mono text-[4.2cqw]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative top-[0.16em] tracking-[0.22em]">
          ****
        </span>
      ))}
      <span className="text-[4.8cqw] tracking-[0.12em]">{last4 ?? "****"}</span>
    </p>
  );
}

/**
 * A credit card rendered as the physical object.
 *
 * The proportion is 1.7, not the 1.586 of a physical ID-1 card. That is
 * deliberate. A true ID-1 rectangle rendered at tile width reads as slightly
 * tall on screen — there is no thickness, no edge, and none of the hand cues
 * that make the real object look right — and the reference art this is built
 * from sits nearer 1.72 for exactly that reason.
 *
 * EVERY dimension inside the face is a percentage of the face's own width
 * (`cqw`, against the `@container` on the root) rather than a fixed pixel size.
 * This is the difference between a card and a box with text in it. The tile is
 * roughly 45% wider on a phone than in the desktop three-column grid, so fixed
 * type left the contents marooned in the middle of a much larger rectangle —
 * the card grew and nothing on it did. Sized this way the face is effectively a
 * photograph: identical at any width, which is also how the real object behaves.
 * The percentages are calibrated so the desktop rendering is unchanged.
 *
 * The corner radius scales for the same reason. It lands on the real card's
 * 3.6% of the long edge, which happens to be the 12px it was already using at
 * desktop width.
 *
 * The face carries identity only — holder, masked number, network, colour. It
 * deliberately shows NO balance. A real card does not print one, and the tile
 * around this component already reports the figures underneath, per currency
 * line, where they can be masked and labelled properly.
 *
 * The foreground is MEASURED from the resolved fill rather than assumed white:
 * the accent can come from card-art inference or from stored user data, and
 * white on a pale silver card is unreadable. `cardForeground` weighs both ends
 * of the gradient, not just the accent — the name and number sit at the bottom
 * left, where the face has already lightened.
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
  const fg = cardForeground(fill);

  const body = (
    <div
      className={cn(
        "@container relative flex aspect-[1.7] w-full flex-col justify-between overflow-hidden rounded-[3.6cqw] p-[6cqw] shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      <div className="flex items-start justify-between gap-[3.6cqw]">
        <CornerDots />
        <NetworkMark network={network} foreground={fg} className="shrink-0" />
      </div>

      <div className="space-y-[1.8cqw]">
        <p className="truncate text-[4.56cqw] leading-none">{holder}</p>
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
