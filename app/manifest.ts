import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cashly · Personal Finance",
    short_name: "Cashly",
    description: "Track accounts, budgets, credit cards, and subscriptions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#faf7f0",
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
