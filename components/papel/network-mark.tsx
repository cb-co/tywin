import { siVisa, siMastercard, siAmericanexpress } from "simple-icons";
import type { CardNetwork } from "@/lib/accounts/network";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { cn } from "@/lib/utils";

/**
 * The network mark on a card face.
 *
 * The artwork is Simple Icons, inlined — the same source a subscription's brand
 * mark comes from, so the two families of logo in this app are now drawn from
 * one set. It replaces three bespoke components carrying hand-cropped vendor
 * artwork, which is also why this app only ever supported three networks: each
 * new one meant sourcing and re-cropping an SVG by hand.
 *
 * Inlining remains the whole point: no third-party request on the accounts page,
 * nothing that leaks which cards a person holds, nothing to fail behind a CSP,
 * and no broken image if a URL ever rots. The card-art model supplies the
 * network NAME only; the drawing is a build-time asset.
 *
 * These three are the ONLY icons imported by name in a client bundle. Anything
 * that needs to look a mark up by SLUG at runtime goes through
 * lib/brand/simple-icon, which is server-only because that lookup drags all
 * 3,450 icons with it. Three static named imports are three path strings.
 *
 * MONOCHROME BY DEFAULT, tinted by the face's own foreground. The marks were
 * previously full-colour, with Visa switching between its two permitted
 * treatments — blue on light, white reversed on dark. A single knocked-out mark
 * is that reversed treatment generalised, and it can never disagree with the
 * lettering beside it. Worth knowing: monochrome is a deviation from the
 * networks' brand guidelines, which is a fine trade on a personal finance app
 * and would not be on a checkout page.
 *
 * AMEX IS THE EXCEPTION, and it is a shape problem rather than a brand one. Visa
 * and Mastercard are open marks — lettering, two overlapping rings — so tinting
 * them draws the mark itself. Amex is a filled PLATE with its lettering knocked
 * out of it, so tinting fills that whole plate: on a silver Platinum face the
 * foreground is dark and the mark became a black block, which is the thing that
 * looked wrong. Drawn in its own blue the plate reads as the Amex badge it
 * actually is, on light and dark faces alike, and the knocked-out lettering
 * keeps working because it is the face showing through rather than a second fill.
 *
 * The blue comes from Simple Icons — the same package the path does, so the mark
 * and its colour can never come from different versions of the artwork.
 *
 * Every viewBox is CROPPED to its own artwork, measured off the rendered paths
 * rather than guessed. That is not a sizing nicety, it is what makes the mark
 * line up with the contactless dots across the top of the card: Simple Icons
 * centres each mark in a 24×24 grid, and Visa's wordmark only fills y 8.1–15.9
 * of it. Rendered on the full grid the ELEMENT starts at the dots and the
 * lettering starts 20px lower, which is exactly the "logo pushed down" it looked
 * like. Cropped, the element IS the wordmark, and `items-start` aligns the thing
 * you can actually see.
 *
 * Cropping also makes these heights directly comparable — but they are still not
 * EQUAL, because equal heights look wrong. Visa is a wide short wordmark;
 * Mastercard a compact pair of circles; Amex a filled plate, and a filled shape
 * reads heavier than an outline at the same size. Matched optically, at the
 * values the hand-cropped vendor logos were tuned to by eye:
 *
 *   Visa       18.4px  (1.15rem)
 *   Mastercard 23.0px  (1.44rem)
 *   Amex       27.7px  (1.73rem)
 *
 * Fixed rather than relative to the card: PaymentCard caps its own width, so the
 * face is near enough the same size everywhere and a mark that tracked it would
 * be solving a problem that no longer exists.
 *
 * When the network can't be inferred, nothing renders. A placeholder chip would
 * imply a network the card doesn't have.
 */
const MARKS: Record<
  CardNetwork,
  {
    path: string;
    viewBox: string;
    height: string;
    /** A fixed brand colour. Omitted means "take the face's foreground". */
    color?: string;
  }
> = {
  visa: { path: siVisa.path, viewBox: "0 8.125 24 7.75", height: "h-[1.15rem]" },
  mastercard: { path: siMastercard.path, viewBox: "0 4.575 24 14.85", height: "h-[1.44rem]" },
  amex: {
    path: siAmericanexpress.path,
    viewBox: "0 0 24 24",
    height: "h-[1.73rem]",
    // Simple Icons stores the hex bare; every consumer adds its own `#`.
    color: `#${siAmericanexpress.hex}`,
  },
};

export function NetworkMark({
  network,
  foreground,
  className,
}: {
  network: CardNetwork | null;
  /**
   * The face's resolved foreground. Passed in rather than re-derived from the
   * fill so the mark and the lettering beside it can never disagree about
   * whether this card is a light one. Ignored by a mark that carries its own
   * brand colour.
   */
  foreground: string;
  className?: string;
}) {
  if (!network) return null;
  const { path, viewBox, height, color } = MARKS[network];

  return (
    <BrandGlyph
      path={path}
      viewBox={viewBox}
      className={cn(height, "w-auto", className)}
      style={{ color: color ?? foreground }}
    />
  );
}
