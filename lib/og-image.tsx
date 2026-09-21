import { ImageResponse } from "next/og";
import { WORDMARK_RATIO, WORDMARK_VIEWBOX, WordmarkPaths } from "@/lib/papel/wordmark";
import { SealSvg } from "@/lib/pwa/icon";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Renders the Cigua seal (SealSvg, the static twin of components/papel/seal.tsx)
 * on a note-violet field at OG resolution. Colours are repeated literally
 * because an ImageResponse is rasterised with no stylesheet in scope; keep them
 * in step with the `--note` tokens in app/globals.css.
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
        <svg
          width={Math.round(110 * WORDMARK_RATIO)}
          height={110}
          viewBox={WORDMARK_VIEWBOX}
          fill="none"
        >
          <WordmarkPaths color="#1b1530" />
        </svg>
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
