import { ImageResponse } from "next/og";
import { SealSvg } from "@/lib/pwa/icon";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Renders the same brand mark as app/favicon.ico (the Coins glyph knocked out
 * of the signature gradient — see components/brand/logo.tsx) at OG resolution.
 * The gradient is repeated literally because an ImageResponse is rasterised
 * with no stylesheet in scope; keep it in step with `--hero`.
 */
export function renderBrandOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eeebf5",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 200,
            height: 200,
            borderRadius: 100,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#4a1f8c",
            marginBottom: 44,
          }}
        >
          <SealSvg size={168} />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: -2,
            color: "#1b1530",
          }}
        >
          Cashly
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 32,
            color: "#544a6c",
          }}
        >
          Track accounts, budgets, and subscriptions.
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
