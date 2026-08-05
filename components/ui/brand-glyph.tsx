/**
 * One Simple Icons path, drawn.
 *
 * Takes the `path` string rather than a slug on purpose: resolving a slug means
 * loading the whole icon set, which is server-only (see lib/brand/simple-icon),
 * so the lookup happens upstream and only the ~500 bytes actually needed reach
 * the browser. That keeps this usable from client components without dragging
 * megabytes behind it.
 *
 * Every mark is monochrome and inherits `currentColor`, so the caller sets the
 * colour the same way it sets any text colour — and the mark can never disagree
 * with the lettering beside it about whether it is sitting on a light surface.
 *
 * `aria-hidden` because it never stands alone: the subscription's name is beside
 * it and the card face already names the network. Announcing "Netflix" twice
 * helps nobody.
 */
export function BrandGlyph({
  path,
  className,
  style,
  viewBox = "0 0 24 24",
}: {
  path: string;
  className?: string;
  /** For callers that set the colour from a measured value rather than a class. */
  style?: React.CSSProperties;
  /**
   * Cropped to the artwork by callers that need the ELEMENT to be the mark.
   *
   * The default is Simple Icons' own 24×24 grid, which is right when the glyph
   * is centred inside something — a subscription's disc — because the padding
   * around a mark is what centres it. It is wrong when the mark has to line up
   * with a neighbour: a wordmark like Visa fills a third of its box's height and
   * floats in the middle of it, so aligning the box aligns nothing you can see.
   */
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <path d={path} />
    </svg>
  );
}
