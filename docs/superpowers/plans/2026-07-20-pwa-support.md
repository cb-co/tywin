# PWA Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cashly installable as a PWA from the browser, with a calm offline fallback and no caching of financial data.

**Architecture:** Next.js 16 App Router metadata-route conventions (`manifest.ts`, `apple-icon.tsx`) generate the manifest and icons; a hand-written `public/sw.js` (no library) caches only the static app shell and serves an offline fallback page for failed navigations; a client component drives a custom "Install app" row in Settings using the `beforeinstallprompt` event, with an iOS-specific fallback.

**Tech Stack:** Next.js 16 (App Router), `next/og` `ImageResponse` (already used by `lib/og-image.tsx`), next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-pwa-design.md`

## Global Constraints

- No offline caching of account/transaction/budget data or any API/Supabase response — the service worker must pass those requests straight to the network. (Spec: Non-goals, Service worker)
- No new runtime dependency for the service worker (no `next-pwa`, no `serwist`) — hand-written `public/sw.js`. (Spec: Service worker)
- Manifest `background_color` and `theme_color`: `#faf7f0`. (Spec: Manifest)
- Icons reuse the existing brand mark exactly: ivory tile `#e7e1d3` background, graphite `#2b2f2c` stroke, the same `Coins` glyph path data as `components/brand/logo.tsx` / `lib/og-image.tsx`. No new artwork. (Spec: Icons, Non-goals)
- `display: "standalone"`, `start_url: "/"`, `scope: "/"`. (Spec: Manifest)
- Icon sizes: 192×192, 512×512, 512×512 maskable, plus a 180×180 Apple touch icon. (Spec: Icons)

---

### Task 1: Brand icon renderer and PNG icon routes

**Files:**
- Create: `lib/pwa/icon.tsx`
- Create: `app/icon-192.png/route.tsx`
- Create: `app/icon-512.png/route.tsx`
- Create: `app/icon-maskable.png/route.tsx`
- Create: `app/apple-icon.tsx`

**Interfaces:**
- Produces: `renderAppIcon({ size, maskable }: { size: number; maskable?: boolean }): ImageResponse` from `lib/pwa/icon.tsx`, used by every route in this task and by Task 2's manifest (indirectly, via the icon URLs it lists).

No automated test for this task: `ImageResponse` output is a rendered PNG stream, and this repo has no image-diffing or DOM test infra (see spec's Testing section — this is manual/build-verified, not unit-tested). Verification is a production build plus inspecting the printed route table.

- [ ] **Step 1: Create the shared icon renderer**

```tsx
// lib/pwa/icon.tsx
import { ImageResponse } from "next/og";

const TILE_LIGHT = "#e7e1d3";
const GLYPH = "#2b2f2c";

/**
 * Same mark as components/brand/logo.tsx / lib/og-image.tsx: the Lucide
 * "Coins" glyph in graphite on an ivory tile. Kept in one place so every
 * icon size/purpose stays pixel-consistent with the favicon and OG image.
 */
export function renderAppIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}) {
  const glyphSize = maskable ? size * 0.45 : size * 0.56;
  const tileRadius = maskable ? 0 : Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: TILE_LIGHT,
          borderRadius: tileRadius,
        }}
      >
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={GLYPH}
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
    ),
    { width: size, height: size },
  );
}
```

- [ ] **Step 2: Create the 192×192 icon route**

```tsx
// app/icon-192.png/route.tsx
import { renderAppIcon } from "@/lib/pwa/icon";

export function GET() {
  return renderAppIcon({ size: 192 });
}
```

- [ ] **Step 3: Create the 512×512 icon route**

```tsx
// app/icon-512.png/route.tsx
import { renderAppIcon } from "@/lib/pwa/icon";

export function GET() {
  return renderAppIcon({ size: 512 });
}
```

- [ ] **Step 4: Create the 512×512 maskable icon route**

```tsx
// app/icon-maskable.png/route.tsx
import { renderAppIcon } from "@/lib/pwa/icon";

export function GET() {
  return renderAppIcon({ size: 512, maskable: true });
}
```

- [ ] **Step 5: Create the Apple touch icon**

```tsx
// app/apple-icon.tsx
import { renderAppIcon } from "@/lib/pwa/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon({ size: 180 });
}
```

- [ ] **Step 6: Build and confirm the routes are recognized as static**

Run: `npm run build`

Expected: build succeeds, and the route table it prints includes
`○ /icon-192.png`, `○ /icon-512.png`, `○ /icon-maskable.png`, and
`○ /apple-icon.png` (or `/apple-icon`), each marked `○ (Static)` — confirming
Next resolved the dot-containing folder names as literal route segments and
prerendered them at build time (no request data is used, so nothing forces
them dynamic).

- [ ] **Step 7: Commit**

```bash
git add lib/pwa/icon.tsx app/icon-192.png app/icon-512.png app/icon-maskable.png app/apple-icon.tsx
git commit -m "feat(pwa): add app icon routes reusing the existing brand mark"
```

---

### Task 2: Web app manifest

**Files:**
- Create: `app/manifest.ts`
- Test: `app/manifest.test.ts`

**Interfaces:**
- Consumes: icon URLs `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` (served by Task 1's routes).
- Produces: default export `manifest(): MetadataRoute.Manifest` from `app/manifest.ts`, auto-served by Next at `/manifest.webmanifest` and auto-linked into `<head>`. No other task imports this directly.

- [ ] **Step 1: Write the failing test**

```ts
// app/manifest.test.ts
import { expect, test } from "vitest";
import manifest from "./manifest";

test("exposes 192, 512, and a maskable 512 icon", () => {
  const result = manifest();
  const sizes = result.icons?.map((icon) => icon.sizes);
  expect(sizes).toEqual(["192x192", "512x512", "512x512"]);
  expect(result.icons?.[2]?.purpose).toBe("maskable");
});

test("launches standalone with the brand ivory background", () => {
  const result = manifest();
  expect(result.display).toBe("standalone");
  expect(result.background_color).toBe("#faf7f0");
  expect(result.theme_color).toBe("#faf7f0");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/manifest.test.ts`
Expected: FAIL — `Cannot find module './manifest'` (the file doesn't exist yet).

- [ ] **Step 3: Create the manifest**

```ts
// app/manifest.ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/manifest.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Build and confirm the manifest route is recognized**

Run: `npm run build`
Expected: route table includes `○ /manifest.webmanifest`.

- [ ] **Step 6: Commit**

```bash
git add app/manifest.ts app/manifest.test.ts
git commit -m "feat(pwa): add web app manifest"
```

---

### Task 3: iOS user-agent detection helper

**Files:**
- Create: `lib/pwa/is-ios.ts`
- Test: `lib/pwa/is-ios.test.ts`

**Interfaces:**
- Produces: `isIosUserAgent(userAgent: string): boolean` from `lib/pwa/is-ios.ts`, consumed by Task 5's `components/pwa/install-app-row.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/pwa/is-ios.test.ts
import { expect, test } from "vitest";
import { isIosUserAgent } from "./is-ios";

test("detects iPhone and iPad user agents", () => {
  const iphoneUa =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
  const ipadUa =
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
  expect(isIosUserAgent(iphoneUa)).toBe(true);
  expect(isIosUserAgent(ipadUa)).toBe(true);
});

test("does not flag Android or desktop user agents", () => {
  const androidUa =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0";
  const macUa =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
  expect(isIosUserAgent(androidUa)).toBe(false);
  expect(isIosUserAgent(macUa)).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/pwa/is-ios.test.ts`
Expected: FAIL — `Cannot find module './is-ios'`.

- [ ] **Step 3: Implement the helper**

```ts
// lib/pwa/is-ios.ts
export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/pwa/is-ios.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/pwa/is-ios.ts lib/pwa/is-ios.test.ts
git commit -m "feat(pwa): add iOS user-agent detection helper"
```

---

### Task 4: Service worker, offline fallback page, and registration

**Files:**
- Create: `public/sw.js`
- Create: `public/offline.html`
- Create: `components/pwa/register-service-worker.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (icons/manifest are referenced by URL string, not import).
- Produces: `RegisterServiceWorker` component from `components/pwa/register-service-worker.tsx`, mounted once from `app/layout.tsx`. No other task imports it.

No automated test: `public/sw.js` runs in a service-worker global scope (`self`, `caches`, `clients`) this repo has no test harness for, and `RegisterServiceWorker` is a one-line effect wrapping a browser API. Both are covered by Task 6's manual verification.

- [ ] **Step 1: Create the offline fallback page**

```html
<!-- public/offline.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cashly — Offline</title>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #faf7f0;
        color: #17211c;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }
      .card {
        max-width: 22rem;
        padding: 2rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0 0 0.5rem;
      }
      p {
        margin: 0 0 1.5rem;
        color: #6a7168;
      }
      button {
        border: none;
        border-radius: 0.6rem;
        background: #0f7a54;
        color: #f6fbf8;
        padding: 0.6rem 1.25rem;
        font-size: 0.95rem;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're offline</h1>
      <p>
        Cashly needs a connection to load your accounts. Check your network
        and try again.
      </p>
      <button onclick="location.reload()">Retry</button>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Create the service worker**

```js
// public/sw.js
const CACHE_VERSION = "cashly-shell-v1";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  if (APP_SHELL.includes(new URL(request.url).pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }

  // Everything else (API routes, Supabase requests, page data) is left
  // alone — no respondWith() means the browser handles it as a normal,
  // uncached network request.
});
```

- [ ] **Step 3: Create the registration component**

```tsx
// components/pwa/register-service-worker.tsx
"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
```

- [ ] **Step 4: Mount registration and add iOS standalone metadata in the root layout**

Read `app/layout.tsx` first to confirm line numbers before editing — it was
last read at 108 lines during design. Two edits:

Add the import near the other component imports (after the `Toaster`
import):

```tsx
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { SPLASH_SKIP_SCRIPT } from "@/lib/splash";
```

Add `appleWebApp` to the `metadata` export, right after the existing
`robots` field:

```tsx
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cashly",
  },
};
```

Mount the component inside `<body>`, alongside `Toaster`:

```tsx
            {children}
            <Toaster richColors />
            <RegisterServiceWorker />
```

- [ ] **Step 5: Build to confirm the metadata types and imports are valid**

Run: `npm run build`
Expected: build succeeds with no type errors on the `appleWebApp` metadata
field or the new import.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js public/offline.html components/pwa/register-service-worker.tsx app/layout.tsx
git commit -m "feat(pwa): add service worker with offline fallback and register it"
```

---

### Task 5: Install prompt UI in Settings

**Files:**
- Create: `components/pwa/install-app-row.tsx`
- Modify: `components/settings/settings-panel.tsx`
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Consumes: `isIosUserAgent` from `lib/pwa/is-ios.ts` (Task 3); the `Row` component this task exports from `components/settings/settings-panel.tsx`.
- Produces: `InstallAppRow` component from `components/pwa/install-app-row.tsx`, rendered once from `SettingsPanel`.

No automated test: the component's behavior is driven entirely by browser
events (`beforeinstallprompt`, `appinstalled`, `matchMedia`) this repo's test
setup (plain Vitest, no jsdom/testing-library) can't simulate. Covered by
Task 6's manual verification.

- [ ] **Step 1: Export `Row` from `settings-panel.tsx`**

In `components/settings/settings-panel.tsx`, change:

```tsx
function Row({
```

to:

```tsx
export function Row({
```

- [ ] **Step 2: Create the install prompt row**

```tsx
// components/pwa/install-app-row.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Row } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { isIosUserAgent } from "@/lib/pwa/is-ios";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "unsupported" | "installable" | "ios" | "installed";

export function InstallAppRow({ index }: { index: number }) {
  const t = useTranslations("Pwa");
  const [state, setState] = useState<InstallState>("unsupported");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standaloneFlag = (
      window.navigator as unknown as { standalone?: boolean }
    ).standalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      standaloneFlag === true;
    if (isStandalone) {
      setState("installed");
      return;
    }

    if (isIosUserAgent(window.navigator.userAgent)) {
      setState("ios");
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setState("installable");
    }

    function onAppInstalled() {
      deferredPrompt.current = null;
      setState("installed");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function onInstallClick() {
    const event = deferredPrompt.current;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setState("installed");
    }
    deferredPrompt.current = null;
  }

  if (state === "unsupported" || state === "installed") return null;

  return (
    <Row index={index} title={t("title")} description={t("description")}>
      {state === "ios" ? (
        <span className="max-w-56 text-right text-sm text-muted-foreground">
          {t("iosInstructions")}
        </span>
      ) : (
        <Button variant="outline" size="sm" onClick={onInstallClick}>
          <Download className="size-4" />
          {t("installButton")}
        </Button>
      )}
    </Row>
  );
}
```

- [ ] **Step 3: Wire it into `SettingsPanel`**

Add the import in `components/settings/settings-panel.tsx`, alongside the
`ThemeToggle` import:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallAppRow } from "@/components/pwa/install-app-row";
```

Insert the row right after the Session row (`index={5}`) and before the
`</Card>` close:

```tsx
        <Row index={5} title={t("sessionTitle")} description={t("sessionDescription")}>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" />
              {t("signOutButton")}
            </Button>
          </form>
        </Row>

        <InstallAppRow index={6} />
      </Card>
```

- [ ] **Step 4: Add English translations**

In `messages/en.json`, insert a new top-level `"Pwa"` block immediately after
the `"Settings"` block closes (after its `"deleting": "Deleting…"` line):

```json
  "Pwa": {
    "title": "Install app",
    "description": "Add Cashly to your home screen for quick, full-screen access.",
    "installButton": "Install",
    "iosInstructions": "On iOS: tap Share, then \"Add to Home Screen\"."
  },
```

- [ ] **Step 5: Add Spanish translations**

In `messages/es.json`, insert the matching block in the same position
(after the `"Settings"` block's closing `},`):

```json
  "Pwa": {
    "title": "Instalar la app",
    "description": "Añade Cashly a tu pantalla de inicio para acceder rápido, a pantalla completa.",
    "installButton": "Instalar",
    "iosInstructions": "En iOS: toca Compartir y luego \"Añadir a pantalla de inicio\"."
  },
```

- [ ] **Step 6: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add components/pwa/install-app-row.tsx components/settings/settings-panel.tsx messages/en.json messages/es.json
git commit -m "feat(pwa): add install prompt row to Settings"
```

---

### Task 6: Manual verification pass

**Files:** none (verification only; fix-forward commits if issues are found).

This task exercises the browser-chrome behavior none of the earlier tasks
could cover with an automated test: install flow, offline fallback, and iOS
messaging.

- [ ] **Step 1: Ask before starting the dev server**

Per this project's working agreement, confirm with the user before running
`npm run dev` (or `next start`) to do the manual checks below.

- [ ] **Step 2: Run the full test suite and a production build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 3: Desktop install flow (Chrome or Edge)**

Start the app (`npm run build && npm run start`, once approved). Open it in
Chrome, open DevTools → Application → Manifest, and confirm: manifest loads
with no errors, all three icons resolve, "Service Workers" shows `sw.js`
activated. Go to Settings and confirm the "Install app" row appears; click
Install, confirm the app installs and launches standalone (no address bar).
Reload Settings — the row should no longer appear.

- [ ] **Step 4: Offline fallback**

With the app installed (or just running in a normal tab) and the service
worker active, open DevTools → Network → set to "Offline", then navigate to
a route not already loaded (or hard-reload). Confirm the offline fallback
page renders instead of the browser's default error page, and that its
"Retry" button reloads once back online.

- [ ] **Step 5: Confirm financial data is never cached**

In DevTools → Application → Cache Storage, inspect the `cashly-shell-v1`
cache and confirm it contains only the app-shell entries (`manifest.webmanifest`,
the three icons, `offline.html`) — no page HTML, no `/api/*` or Supabase
responses.

- [ ] **Step 6: iOS messaging**

In DevTools' device toolbar, switch to an iPhone device preset (this changes
the reported user agent) and reload Settings. Confirm the row now shows the
"Add to Home Screen" instructions instead of an Install button.

- [ ] **Step 7: Fix forward if anything above fails**

If any check fails, fix the relevant file from Tasks 1–5, re-run the
affected check, and commit the fix with a message describing what was wrong
(e.g. `fix(pwa): correct offline.html cache path`).

- [ ] **Step 8: Merge and push**

```bash
git checkout main
git merge --no-ff <feature-branch>
git push
git branch -d <feature-branch>
git push origin --delete <feature-branch>
```
