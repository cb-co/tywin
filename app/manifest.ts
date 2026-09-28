import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cigua · Personal Finance",
    short_name: "Cigua",
    description: "Track accounts, budgets, credit cards, and subscriptions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Note violet (--note, design/tokens.json): the in-app splash's background
    // (components/shell/splash.tsx), so the OS launch splash hands over to it
    // seamlessly. The icons carry the same violet tile, which disappears into
    // this background and leaves the plate and seal (lib/pwa/icon.tsx).
    background_color: "#4a1f8c",
    // Same violet so the launch splash's status bar matches it; the page's
    // own theme-color meta (app/layout.tsx) takes over once it loads.
    theme_color: "#4a1f8c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
