import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * Simplified network marks, drawn in-repo. They are recognisable shorthand for
 * the network, deliberately not pixel-accurate reproductions of the brands'
 * trademarks, and are used only to label a card the user already owns.
 *
 * `fill` is the card face's own resolved background colour (the hex driving
 * its gradient), used to knock text out of the AMEX mark. `--card` (an app
 * surface token) has no relationship to that user-data colour and can render
 * invisibly against it; the mark's own fill always contrasts by construction,
 * since it is drawn under `currentColor` — the measured foreground.
 *
 * When the network can't be inferred, no mark renders at all: a placeholder
 * chip would imply a network the user's card doesn't have.
 */
export function NetworkMark({
  network,
  fill,
  className,
}: {
  network: CardNetwork | null;
  fill: string;
  className?: string;
}) {
  if (!network) return null;

  const base = cn("h-6 w-auto", className);

  if (network === "mastercard") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Mastercard">
        <circle cx="18" cy="15" r="11" fill="currentColor" opacity="0.9" />
        <circle cx="30" cy="15" r="11" fill="currentColor" opacity="0.55" />
      </svg>
    );
  }
  if (network === "amex") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="American Express">
        <rect x="4" y="3" width="40" height="24" rx="4" fill="currentColor" opacity="0.9" />
        <text x="24" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill={fill}>
          AMEX
        </text>
      </svg>
    );
  }
  // visa, discover, diners, jcb, unionpay — a wordmark-style label, height-matched
  // to the SVG marks above so networks don't jitter against each other.
  return (
    <span
      className={cn(
        base,
        "inline-flex items-center text-sm font-bold tracking-widest uppercase",
      )}
    >
      {network === "unionpay" ? "UnionPay" : network}
    </span>
  );
}
