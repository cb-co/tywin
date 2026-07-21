import type { MetadataRoute } from "next";
import { TOPBAR_DARK } from "../lib/pwa/theme-color";

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
    background_color: "#faf7f0",
    // Matches the dark topbar — see the themeColor comment in app/layout.tsx.
    theme_color: TOPBAR_DARK,
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
