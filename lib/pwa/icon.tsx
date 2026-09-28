import { ImageResponse } from "next/og";

import { BIRD_BODY, BIRD_WING } from "@/lib/papel/bird";
import { ROSETTE_LAYERS, rosettePoints } from "@/lib/papel/rosette";

// Literal form of `--note` and `--note-ink`. An ImageResponse is rasterised
// with no stylesheet in scope, so hex values are repeated here; keep them in
// step with design/tokens.json.
const DISC = "#4a1f8c";
const INK = "#f8f5ff";

/** The guilloche plate (components/papel/guilloche.tsx) at its finished
 *  frame, one path per layer in the canvas's own units: the canvas maps a
 *  176 radius onto half its box, so the viewBox is 352 wide. */
const PLATE_LAYERS = ROSETTE_LAYERS.map((layer) => {
  const pts = rosettePoints(layer);
  let d = "";
  for (let i = 0; i < pts.length; i += 2) {
    d += `${i === 0 ? "M" : "L"}${pts[i].toFixed(2)} ${pts[i + 1].toFixed(2)}`;
  }
  return d;
});

/** The plate as the splash draws it: layer alphas 0.9/0.55 under the
 *  element's 40% opacity. Lines are heavier than the canvas's 0.7px because
 *  an icon is looked at far smaller than the splash, where hairlines vanish. */
function PlateSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-176 -176 352 352"
      fill="none"
      stroke={INK}
      strokeWidth={1.1}
      strokeLinejoin="round"
      style={{ opacity: 0.4 }}
    >
      {PLATE_LAYERS.map((d, i) => (
        <path key={i} d={d} opacity={i === 0 ? 0.9 : 0.55} />
      ))}
    </svg>
  );
}

/** The Seal (components/papel/seal.tsx) as literal SVG for next/og, in the
 *  splash's variant: no rosette ring, which only smears at icon sizes. The
 *  disc is filled so the plate stops at its edge, as it does in the splash. */
export function SealSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={INK}
    >
      <circle cx="32" cy="32" r="32" fill={DISC} stroke="none" />
      <circle cx="32" cy="32" r="30.5" strokeWidth={1.8} />
      <circle cx="32" cy="32" r="22" strokeWidth={1.4} />
      <g
        transform="translate(-0.8 0.2)"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={BIRD_WING} />
        <path d={BIRD_BODY} />
      </g>
    </svg>
  );
}

/**
 * The app icon is the seal sitting on the guilloche plate on a note violet
 * tile, the same pairing as the in-app splash (components/shell/splash.tsx)
 * but with the seal large, since an icon is read at a glance. The manifest's background_color is the same violet, so on the
 * OS launch splash the tile disappears and only plate and seal remain.
 *
 * Below 128px the plate's lines merge into a haze, so small icons (the
 * favicon) drop it and let the seal fill the tile.
 */
export function renderAppIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}) {
  const plate = size >= 128;
  // Maskable icons are cropped to the OS's own shape, and Android's launch
  // splash draws from them through a circle about two thirds of the icon
  // wide, so the whole mark stays inside that circle. That also sets how
  // large it stands on the splash. The seal takes up most of the plate, so
  // the bird carries the icon at launcher size and the plate reads as the
  // engraved band around it.
  const plateSize = Math.round(size * (maskable ? 0.68 : 0.9));
  const sealSize = Math.round(
    plate ? size * (maskable ? 0.4 : 0.54) : size * 0.86,
  );
  const tileRadius = maskable ? 0 : Math.round(size * 0.22);

  // Plate and seal are stacked, each centred on the whole tile.
  const layer = {
    position: "absolute",
    top: 0,
    left: 0,
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          backgroundColor: DISC,
          borderRadius: tileRadius,
        }}
      >
        {plate ? (
          <div style={layer}>
            <PlateSvg size={plateSize} />
          </div>
        ) : null}
        <div style={layer}>
          <SealSvg size={sealSize} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
