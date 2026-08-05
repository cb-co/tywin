import { HEX6 } from "@/lib/color";

/**
 * A subscription's brand colour, when one has been resolved.
 *
 * There is deliberately NO default hex here, unlike DEFAULT_CARD_ACCENT. A card
 * face is a rectangle that has to be *some* colour, so an unresolved card needs
 * a stand-in. A subscription's mark is a small avatar sitting on a card surface,
 * and its unresolved state already has a correct answer: the theme's own accent
 * token, which follows light and dark. Inventing a fixed hex for that case would
 * mean picking one theme to look right in.
 *
 * So callers ask `hasBrandColor` and either style from the stored value or leave
 * the token classes alone — see components/subscriptions/subscriptions-view.
 */
export function hasBrandColor(color: string | null | undefined): boolean {
  return !!color && HEX6.test(color);
}
