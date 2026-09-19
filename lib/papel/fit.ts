/** Tailwind size for the note's denomination figure, by printed length, so
 *  eight digits plus `RD$` scales down on a 360px phone instead of wrapping.
 *  The thresholds are tuned by the 360px capture in the review task. */
export function fitFigureClass(text: string): string {
  const n = text.length;
  if (n <= 9) return "text-5xl sm:text-6xl";
  if (n <= 13) return "text-4xl sm:text-6xl";
  if (n <= 16) return "text-3xl sm:text-5xl";
  return "text-2xl sm:text-4xl";
}
