# PWA Support — Design

Sub-project 1 of 2 (mobile-availability effort). Sub-project 2 is sound
effects, specced separately after this ships. Capacitor wrapping is a later,
unspecced phase that depends on this one existing first.

## Goal

Make Cashly installable as a Progressive Web App directly from the browser
(desktop and mobile), as the first step toward a Capacitor-wrapped native
build later. Scope is deliberately narrow: installability and a calm offline
fallback, not offline data access.

## Non-goals

- Offline caching of account/transaction/budget data. This app renders
  account balances behind auth; caching that data client-side risks showing
  stale financial figures with no network to correct them.
- Push notifications, background sync — deferred to the Capacitor phase.
- New brand artwork — icons reuse the existing ivory-tile + graphite `Coins`
  glyph mark (`components/brand/logo.tsx`), already used for the favicon and
  OG image.

## Manifest

`app/manifest.ts` (Next.js metadata-route convention — auto-served at
`/manifest.webmanifest` and auto-linked in `<head>`):

- `name`: "Cashly · Personal Finance", `short_name`: "Cashly"
- `display`: "standalone", `start_url`: "/", `scope`: "/"
- `background_color` / `theme_color`: `#faf7f0` (the app's existing ivory
  background — matches `--background` in `app/globals.css` and the OG image
  background, so the install/launch splash matches the app itself)
- `icons`: 192×192, 512×512, and a 512×512 `purpose: "maskable"` variant

## Icons

Generated via `ImageResponse` (same pattern already used by
`lib/og-image.tsx` / `app/opengraph-image.tsx`), not new static assets:

- `app/icon-192.png/route.tsx` — 192×192, GET handler returning
  `ImageResponse`. No request-dependent data, so Next statically optimizes it
  at build time.
- `app/icon-512.png/route.tsx` — 512×512, same pattern.
- `app/icon-maskable.png/route.tsx` — 512×512 with the glyph padded into a
  safe zone (roughly the inner 80%) so Android's adaptive-icon mask doesn't
  clip the `Coins` glyph when it applies a shape.
- `app/apple-icon.tsx` — official Next.js convention file; Next
  auto-generates the `<link rel="apple-touch-icon">` tag from it. Covers iOS
  Add-to-Home-Screen, which ignores the web manifest entirely.

## Service worker

`public/sw.js`, hand-written — no `next-pwa`/`serwist` dependency, since the
minimal-caching scope doesn't need a caching-strategy library.

- **Install**: caches a fixed app-shell list — the generated icons, the
  manifest, and a small static offline-fallback HTML page
  (`public/offline.html`).
- **Fetch**:
  - Navigation requests: network-only. On failure, respond with the cached
    offline-fallback page instead of the browser's default error screen.
  - Requests for cached app-shell assets (icons, manifest): cache-first.
  - Everything else (API calls, Supabase requests, page data): pass through
    to the network untouched — never intercepted or cached. This is the
    mechanism that keeps financial data out of the cache.
- **Activate**: deletes any cache whose name doesn't match the current
  version string, so deploys don't accumulate stale shell caches.
- **Registration**: a small client component
  (`components/pwa/register-sw.tsx`) calls
  `navigator.serviceWorker.register("/sw.js")` in a `useEffect`, mounted once
  from the root layout. Not an inline script — avoids touching the
  nonce/CSP plumbing `app/layout.tsx` already carries for the splash-skip
  script.

## Install UX

- `components/pwa/install-button.tsx` (client component):
  - Listens for `beforeinstallprompt`, calls `preventDefault()`, stashes the
    event.
  - Renders an "Install app" button (Card, consistent with the existing
    Settings page style) that calls the stashed event's `.prompt()` when
    clicked.
  - Hides itself once the app is installed — either the `appinstalled` event
    fires, or `window.matchMedia("(display-mode: standalone)")` is already
    true on mount (covers "already installed" and "launched from home
    screen").
  - If `beforeinstallprompt` never fires within a short window (Safari,
    unsupported browsers), falls back to a static "Add to Home Screen"
    instructions block for iOS (detected via UA sniffing `navigator.userAgent`
    for iOS + Safari), and renders nothing on other unsupported browsers.
- Placed in Settings (`app/(app)/settings/page.tsx` /
  `components/settings/settings-panel.tsx`) as a card near the existing
  `ThemeToggle`, since that's already the "app preferences" surface.
- iOS standalone meta tags added to `app/layout.tsx`'s `metadata` export:
  `appleWebApp: { capable: true, statusBarStyle: "default", title: "Cashly" }`
  (Next.js's typed metadata API covers `apple-mobile-web-app-capable` etc.
  without hand-written `<meta>` tags).
- New i18n strings added to both `messages/en.json` and `messages/es.json`
  under a new `Pwa` namespace, following the existing next-intl structure.

## Testing

- `npm run build` succeeds and the manifest/icon routes produce valid output.
- Manual verification (this repo doesn't have browser/e2e test coverage for
  UI flows): install prompt appears in Chrome desktop, install succeeds, app
  launches standalone, offline fallback page appears when network is cut
  after install, iOS instructions render correctly under iOS UA.
- No existing automated tests are expected to cover this — it's browser-chrome
  behavior (manifest/SW registration), not application logic.
