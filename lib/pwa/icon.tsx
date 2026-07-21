import { ImageResponse } from "next/og";

const TILE_LIGHT = "#e7e1d3";
const GLYPH = "#2b2f2c";

/**
 * Same mark as components/brand/logo.tsx / lib/og-image.tsx: the Lucide
 * "Coins" glyph in graphite on an ivory tile. Kept in one place so every
 * icon size/purpose stays pixel-consistent with the favicon and OG image.
 */
export function renderAppIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}) {
  const glyphSize = maskable ? size * 0.45 : size * 0.56;
  const tileRadius = maskable ? 0 : Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: TILE_LIGHT,
          borderRadius: tileRadius,
        }}
      >
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={GLYPH}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
          <path d="M15 6h1v4" />
          <path d="m6.134 14.768.866-.5 2 3.464" />
          <circle cx="16" cy="8" r="6" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
