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
 * The proportion is 1.7, not the 1.586 of a physical ID-1 card. That is
 * deliberate. A true ID-1 rectangle rendered at tile width reads as slightly
 * tall on screen — there is no thickness, no edge, and none of the hand cues
 * that make the real object look right — and the reference art this is built
 * from sits nearer 1.72 for exactly that reason.
 *
 * The face is CAPPED at 22rem rather than filling its tile. That is what keeps
 * it looking right on a phone: single-column, the tile runs ~28% wider than a
 * desktop grid column, and with fixed type the contents ended up marooned in
 * the middle of a much larger rectangle — the card grew and nothing on it did.
 * Capping the width means every dimension inside can stay a fixed size and the
 * proportions hold everywhere.
 *
 * An earlier attempt sized everything in `cqw` against a container on this
 * element. It broke badly: an element does NOT query itself, so the card's own
 * padding and radius resolved against the nearest ANCESTOR container — the
 * viewport — giving a 44px corner radius and 73px of padding on desktop. Only
 * the descendants resolved correctly. A cap plus fixed sizes needs none of
 * that machinery.
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
        "relative mx-auto flex aspect-[1.7] w-full max-w-[22rem] flex-col justify-between overflow-hidden rounded-[0.75rem] p-5 shadow-(--shadow-card)",
        className,
      )}
      style={{ backgroundImage: gradientFrom(fill), color: fg }}
    >
      {/* The lit edge. A real card is a moulded object with a thickness, and
          the single strongest cue for that is a bright top edge with a darker
          one beneath — light from above catching the bevel. Fixed white and
          black rather than polarity-flipped like the sheen, because each is
          simply invisible on the theme that would fight it: a white top edge
          disappears on a pale card, a dark bottom edge disappears on a dark
          one. Neither can hurt, so neither needs a branch.

          A separate element rather than more insets on the card, because the
          card's own box-shadow is a token and layering onto it here would mean
          restating it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.14)]"
      />

      <div className="relative flex items-start justify-between gap-3">
        <CornerDots />
        <NetworkMark network={network} foreground={fg} className="shrink-0" />
      </div>

      <div className="relative space-y-1.5">
        {/* Uppercase and tracked out, because that is what embossing IS — the
            machine that presses a name into a card has one case. A mixed-case
            "Robert" reads as a text field that happened to land on a picture of
            a card; the same name in caps reads as part of the object. The letter
            spacing is small but load-bearing: real embossing is monospaced-ish
            and set wide, and caps without it look shouted rather than pressed.

            Done in CSS rather than by upper-casing the string, so the profile
            name is untouched everywhere else and locale-aware casing is the
            browser's problem, not ours. */}
        <p className="truncate text-[0.95rem] uppercase leading-none tracking-[0.07em] font-[family-name:var(--font-card-serif)]">
          {holder}
        </p>
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
