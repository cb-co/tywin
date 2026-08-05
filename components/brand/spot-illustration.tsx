import { cn } from "@/lib/utils";

/**
 * Flat spot art for headings that would otherwise open on a wall of text: the
 * login hero, the marketing page, and empty states.
 *
 * These are stacked geometric planes in tints of ONE hue, not drawings. That is
 * the whole constraint — it is what keeps them cheap to add, impossible to get
 * subtly wrong, and recognisably the same family across surfaces.
 *
 * Every scene paints in `currentColor` rather than a fixed token, and the
 * wrapper defaults to `text-brand` so the default rendering is the brand hue on
 * a card. The indirection earns its keep on the login hero, which is the
 * gradient slab: `--brand` there would be violet on violet and vanish, so that
 * call site overrides the text colour to the hero foreground instead. Tints are
 * opacities of whatever colour is inherited, so both cases stay legible without
 * a second set of scenes.
 *
 * All of these are decorative and always sit next to a real heading, so they
 * are `aria-hidden` and contribute nothing to the accessibility tree.
 */
const SCENES = {
  /** Stacked cards, for accounts and anything wallet-shaped. */
  wallet: (
    <>
      <rect x="18" y="46" width="84" height="56" rx="12" fill="currentColor" opacity="0.25" />
      <rect x="30" y="34" width="84" height="56" rx="12" fill="currentColor" opacity="0.55" />
      <circle cx="96" cy="62" r="8" fill="currentColor" />
    </>
  ),
  /** Rising bars, for insights, budgets and anything about a trend. */
  chart: (
    <>
      <rect x="24" y="70" width="18" height="34" rx="6" fill="currentColor" opacity="0.35" />
      <rect x="52" y="48" width="18" height="56" rx="6" fill="currentColor" opacity="0.6" />
      <rect x="80" y="28" width="18" height="76" rx="6" fill="currentColor" />
    </>
  ),
  /** A disc with a single bar through it — deliberately the quietest scene, so
      an empty state reads as "nothing here yet" rather than as a broken chart. */
  empty: (
    <>
      <circle cx="64" cy="64" r="38" fill="currentColor" opacity="0.18" />
      <rect x="44" y="58" width="40" height="8" rx="4" fill="currentColor" opacity="0.7" />
    </>
  ),
} as const;

export function SpotIllustration({
  scene,
  className,
}: {
  scene: keyof typeof SCENES;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden className={cn("text-brand", className)}>
      {SCENES[scene]}
    </svg>
  );
}
