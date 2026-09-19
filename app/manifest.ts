import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cashly · Personal Finance",
    short_name: "Cashly",
    description: "Track accounts, budgets, credit cards, and subscriptions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Matches the custom in-app splash's background (components/shell/splash.tsx,
    // bg-background) so the native OS launch splash blends into it.
    background_color: "#eeebf5",
    // Paper, the light default (design/tokens.json).
    theme_color: "#eeebf5",
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
