import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Renders the same brand mark as app/favicon.ico (ivory tile, graphite
 * Coins glyph — see components/brand/logo.tsx) at OG resolution.
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
          backgroundColor: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 200,
            height: 200,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ece5d6",
            boxShadow: "0 1px 0 rgba(255,255,255,0.55) inset",
            marginBottom: 44,
          }}
        >
          <svg
            width="112"
            height="112"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#26221e"
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
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: -2,
            color: "#211d1a",
          }}
        >
          Cashly
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 32,
            color: "#6d6862",
          }}
        >
          Track accounts, budgets, and subscriptions.
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
