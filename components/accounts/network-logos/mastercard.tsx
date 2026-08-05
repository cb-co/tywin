/**
 * Mastercard's interlocking circles. Source: svgrepo, Apache-2.0.
 *
 * Colour-locked: the mark is only readable as Mastercard in its own red and
 * amber, so unlike the other two this never follows the card's foreground.
 *
 * The source approximated the interlock with `fill-opacity` on the amber
 * circle, which works on white and lets the CARD colour bleed through on
 * everything else. The overlap is drawn as its own shape here so the mark holds
 * on any fill. The lens is exact: two r=7 circles with centres 10 apart meet at
 * x=12, y = 12 ± sqrt(7² − 5²).
 *
 * The box is cropped to the circles' own extent (y 5 to 19) so a CSS height
 * here means the same thing it means on the other two marks.
 */
export function MastercardLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 5 24 14" className={className} role="img" aria-label="Mastercard">
      <circle cx="7" cy="12" r="7" fill="#EA001B" />
      <circle cx="17" cy="12" r="7" fill="#FFA200" />
      <path d="M12 7.101a7 7 0 0 1 0 9.798 7 7 0 0 1 0-9.798Z" fill="#FF5F00" />
    </svg>
  );
}
