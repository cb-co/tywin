import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/* Baseline security headers.
 *
 * Deliberately no Content-Security-Policy here. A useful CSP needs a
 * per-request nonce for the two inline scripts this app ships (the splash
 * skip check and next-themes' pre-paint theme script), which means generating
 * one in the proxy and threading it through. A CSP with 'unsafe-inline'
 * instead would pass a scanner while blocking almost nothing, so it is left
 * out rather than faked. See the security notes for the follow-up. */
const securityHeaders = [
  // This app renders account balances; there is no reason to allow framing.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Full URLs can carry auth codes on /auth/callback. Never leak them cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Only meaningful over HTTPS; harmless on localhost since browsers ignore
  // it for http origins.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Drops the `X-Powered-By: Next.js` version banner.
  poweredByHeader: false,

  // pdfjs-dist must run as a real Node package, not be bundled into server
  // actions: the bundled copy throws non-PasswordException errors on
  // encrypted statements, which statement import misreads as "unreadable"
  // instead of prompting for the PDF password.
  //
  // @napi-rs/canvas is pdfjs's DOMMatrix/Path2D polyfill source and a native
  // addon — it can't be bundled either. pdfjs loads it through
  // process.getBuiltinModule("module").createRequire(), which Vercel's file
  // tracer can't see, so extract.ts imports it directly to get it (and its
  // platform binary) into the serverless bundle. Without it, pdf.mjs throws
  // `DOMMatrix is not defined` at module load in production.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
