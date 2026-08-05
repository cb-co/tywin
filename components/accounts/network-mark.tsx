import type { CardNetwork } from "@/lib/accounts/network";
import { readableForeground } from "@/lib/color";
import { VisaLogo } from "./network-logos/visa";
import { MastercardLogo } from "./network-logos/mastercard";
import { AmexLogo } from "./network-logos/amex";
import { cn } from "@/lib/utils";

/**
 * The network mark on a card face.
 *
 * The logos are real vendor artwork (sourced under their respective licences —
 * see each component) inlined as SVG rather than fetched. Inlining is the whole
 * point: no third-party request on the accounts page, nothing that leaks which
 * cards a person holds, nothing to fail behind a CSP, and no broken image if a
 * URL ever rots. The card-art model supplies the network NAME only; the drawing
 * is a build-time asset.
 *
 * Each mark keeps its own viewBox and gets its own height, because their
 * proportions differ wildly — Amex is a landscape plate, Mastercard is nearly
 * square, Visa is a wide wordmark. Matching heights numerically would make Amex
 * tower over Visa, so these are matched OPTICALLY instead: they are tuned to
 * look like the same size on a wall of cards, which is what the eye judges.
 *
 * When the network can't be inferred, nothing renders. A placeholder chip would
 * imply a network the card doesn't have.
 */
export function NetworkMark({
  network,
  fill,
  className,
}: {
  network: CardNetwork | null;
  /** The card's resolved background, for marks that adapt to it. */
  fill: string;
  className?: string;
}) {
  if (!network) return null;

  if (network === "visa") {
    // Visa publishes two permitted treatments — blue on light, white reversed
    // on dark. Which one applies is the same question the face already answers
    // for its own text, so it is answered the same way rather than guessed.
    const tone = readableForeground(fill) === "#ffffff" ? "dark" : "light";
    return <VisaLogo tone={tone} className={cn("h-5 w-auto", className)} />;
  }

  if (network === "mastercard") {
    return <MastercardLogo className={cn("h-8 w-auto", className)} />;
  }

  return <AmexLogo className={cn("h-8 w-auto", className)} />;
}
