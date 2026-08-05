import type { CardNetwork } from "@/lib/accounts/network";
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
 * Every viewBox is cropped to its own artwork, so these heights are directly
 * comparable — but they are still not EQUAL, because equal heights look wrong.
 * Visa is a wide, short wordmark; Mastercard is a compact pair of circles; Amex
 * is a filled landscape plate, and a filled shape reads heavier than an outline
 * at the same size. They are matched optically:
 *
 *   Visa       16px tall, ~50px wide
 *   Mastercard 20px tall, ~34px wide
 *   Amex       24px tall, ~38px wide
 *
 * When the network can't be inferred, nothing renders. A placeholder chip would
 * imply a network the card doesn't have.
 */
export function NetworkMark({
  network,
  foreground,
  className,
}: {
  network: CardNetwork | null;
  /**
   * The face's resolved foreground. Passed in rather than re-derived from the
   * fill so the mark and the lettering beside it can never disagree about
   * whether this card is a light one.
   */
  foreground: string;
  className?: string;
}) {
  if (!network) return null;

  if (network === "visa") {
    // Visa publishes two permitted treatments — blue on light, white reversed
    // on dark — and this picks between them off the same answer the face
    // already reached for its own text.
    return (
      <VisaLogo
        tone={foreground === "#ffffff" ? "dark" : "light"}
        className={cn("h-4 w-auto", className)}
      />
    );
  }

  if (network === "mastercard") {
    return <MastercardLogo className={cn("h-5 w-auto", className)} />;
  }

  return <AmexLogo className={cn("h-6 w-auto", className)} />;
}
