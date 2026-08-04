import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * Simplified network marks, drawn in-repo. They are recognisable shorthand for
 * the network, deliberately not pixel-accurate reproductions of the brands'
 * trademarks, and are used only to label a card the user already owns.
 */
export function NetworkMark({
  network,
  className,
}: {
  network: CardNetwork | null;
  className?: string;
}) {
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
        <text x="24" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--card)">
          AMEX
        </text>
      </svg>
    );
  }
  if (network) {
    // visa, discover, diners, jcb, unionpay — a wordmark-style label.
    return (
      <span className={cn("text-sm font-extrabold tracking-widest uppercase", className)}>
        {network === "unionpay" ? "UnionPay" : network}
      </span>
    );
  }
  // No network known: a neutral chip stands in so the corner is not empty.
  return (
    <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Card">
      <rect x="6" y="8" width="20" height="14" rx="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
