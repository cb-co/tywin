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
 * MONOCHROME, tinted by the face's own foreground. The marks were previously
 * full-colour, with Visa switching between its two permitted treatments — blue
 * on light, white reversed on dark. A single knocked-out mark is that reversed
 * treatment generalised, and it can never disagree with the lettering beside it.
 * Worth knowing: monochrome is a deviation from the networks' brand guidelines,
 * which is a fine trade on a personal finance app and would not be on a checkout
 * page.
 *
 * SIZING stays per-network, and the reason changed. Simple Icons draws each mark
 * to fill its own 24×24 box, so one box size does NOT give one optical size:
 * Visa is a wide short wordmark filling about a third of its box's height,
 * Mastercard's circles about two thirds, and Amex is a solid plate edge to edge
 * — and a filled shape reads far heavier than an outline at the same size. The
 * boxes below are set so the ARTWORK inside them lands on the heights the
 * hand-cropped logos were tuned to by eye:
 *
 *   Visa       3.7rem  box → 18.4px of wordmark
 *   Mastercard 2.31rem box → 23.0px of circles
 *   Amex       1.75rem box → 27.7px of plate
 *
 * Fixed rather than relative to the card: PaymentCard caps its own width, so the
 * face is near enough the same size everywhere and a mark that tracked it would
 * be solving a problem that no longer exists.
 *
 * When the network can't be inferred, nothing renders. A placeholder chip would
 * imply a network the card doesn't have.
 */
const MARKS: Record<CardNetwork, { path: string; box: string }> = {
  visa: { path: siVisa.path, box: "size-[3.7rem]" },
  mastercard: { path: siMastercard.path, box: "size-[2.31rem]" },
  amex: { path: siAmericanexpress.path, box: "size-[1.75rem]" },
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
   * whether this card is a light one.
   */
  foreground: string;
  className?: string;
}) {
  if (!network) return null;
  const { path, box } = MARKS[network];

  return <BrandGlyph path={path} className={cn(box, className)} style={{ color: foreground }} />;
}
