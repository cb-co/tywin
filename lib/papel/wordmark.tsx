/**
 * The "cigua" wordmark: soft, rounded, lowercase, drawn as monoline strokes
 * with round caps (x-height 40, stroke 9). It is outlined geometry, not a
 * font, so it loads nothing and takes `currentColor` on the web and a literal
 * ink in next/og. This is the one deliberate exception to the One Face Rule
 * (DESIGN.md): the wordmark is a drawn mark, like the Seal, not typeset copy.
 */
export const WORDMARK_VIEWBOX = "0 -15 193 78";
export const WORDMARK_RATIO = 193 / 78;

export function WordmarkPaths({ color = "currentColor" }: { color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
      {/* c */}
      <path d="M30.96 9.04 A15.5 15.5 0 1 0 30.96 30.96" />
      {/* i: stem, then the dot */}
      <path d="M50.5 4.5 V35.5" />
      <circle cx="50.5" cy="-9" r="5" fill={color} stroke="none" />
      {/* g: bowl, right stem, descender hook */}
      <g transform="translate(61 0)">
        <circle cx="20" cy="20" r="15.5" />
        <path d="M35.5 20 V45 C35.5 53 29.5 57 22 57 C17 57 13 55.5 10 52.5" />
      </g>
      {/* u */}
      <g transform="translate(107 0)">
        <path d="M4.5 4.5 V20 A15.5 15.5 0 0 0 35.5 20 V4.5 M35.5 20 V32" />
      </g>
      {/* a */}
      <g transform="translate(153 0)">
        <circle cx="20" cy="20" r="15.5" />
        <path d="M35.5 4.5 V32" />
      </g>
    </g>
  );
}
