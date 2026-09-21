import { ImageResponse } from "next/og";

import { BIRD_BODY, BIRD_FEATHER, BIRD_WING } from "@/lib/papel/bird";
import { rosettePath } from "@/lib/papel/rosette";

// Literal form of `--note` and `--note-ink`. An ImageResponse is rasterised
// with no stylesheet in scope, so hex values are repeated here; keep them in
// step with design/tokens.json.
const DISC = "#4a1f8c";
const INK = "#f8f5ff";
const RING = rosettePath(64);

/** The Seal (components/papel/seal.tsx) as literal SVG for next/og. */
export function SealSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={INK}>
      <path d={RING} strokeWidth={0.35} opacity={0.55} />
      <circle cx="32" cy="32" r="30.5" strokeWidth={1.2} />
      <circle cx="32" cy="32" r="17" strokeWidth={0.8} />
      {/* The inner ring here is r=17, so the bird is scaled to sit inside it. */}
      <g
        transform="translate(32 32) scale(0.74) translate(-32.8 -31.8)"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={BIRD_WING} />
        <path d={BIRD_FEATHER} strokeWidth={1} />
        <path d={BIRD_BODY} />
      </g>
    </svg>
  );
}

/**
 * Same mark as components/brand/logo.tsx: the engraved seal on a flat note
 * violet tile. Kept in one place so every icon size/purpose stays consistent.
 */
export function renderAppIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}) {
  // Maskable icons get a safe zone (the OS crops to its own shape).
  const sealSize = Math.round(maskable ? size * 0.7 : size * 0.86);
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
          backgroundColor: DISC,
          borderRadius: tileRadius,
        }}
      >
        <SealSvg size={sealSize} />
      </div>
    ),
    { width: size, height: size },
  );
}
