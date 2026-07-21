# Task 4 Report: Service worker, offline fallback page, and registration

## What was implemented

Three new files created exactly per the brief, plus three additive edits to `app/layout.tsx`:

1. **`public/offline.html`** — static offline fallback page (ivory background, "You're offline" card, Retry button). Created verbatim from the brief.
2. **`public/sw.js`** — the service worker. Created verbatim from the brief:
   - `install`: precaches `APP_SHELL` (manifest, 3 icons, offline.html) into cache `cashly-shell-v1`, calls `skipWaiting()`.
   - `activate`: deletes any cache key that isn't the current `CACHE_VERSION`, calls `clients.claim()`.
   - `fetch`: see verification section below.
3. **`components/pwa/register-service-worker.tsx`** — client component, one-line `useEffect` that calls `navigator.serviceWorker.register("/sw.js")` if the API exists. Returns `null`.
4. **`app/layout.tsx`** — three additive changes only (see diff region below): new import, new `appleWebApp` metadata field, and `<RegisterServiceWorker />` mounted next to `<Toaster />`.

## How I verified the service worker never caches financial/API data

Walked through `public/sw.js`'s `fetch` handler line by line:

1. **Non-GET requests** (`request.method !== "GET"`): handler returns immediately with no `respondWith()` call. All POST/PUT/PATCH/DELETE requests — every mutation to Supabase or app API routes — are untouched by the service worker and go straight to the network as normal.
2. **Navigation requests** (`request.mode === "navigate"`, i.e. top-level document loads for pages like `/accounts`, `/transactions`, `/budgets`): the handler does `fetch(request).catch(() => caches.match("/offline.html"))`. This always tries the network first — the real, freshly server-rendered HTML for that authenticated page — and only serves the generic precached `offline.html` if the network fetch fails (device is offline). Critically, there is no `cache.put()` anywhere in this branch, so the real page response is never written to a cache. Authenticated page HTML is never persisted by the service worker.
3. **Everything else** (JS/CSS chunks, RSC data fetches, API routes, Supabase REST/Realtime calls, images that aren't in the shell): the handler checks `APP_SHELL.includes(new URL(request.url).pathname)`. `APP_SHELL` is a fixed 5-entry array (`/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png`, `/offline.html`) — none of these paths can ever match an API route or a Supabase request URL (which are either different paths on this origin or a different origin entirely, e.g. `*.supabase.co`). Only for those five fixed static-asset paths does the handler call `respondWith()` with a cache-first strategy. For every other request — which includes 100% of API/Supabase/authenticated-data traffic — `respondWith()` is never called at all, meaning the browser handles it as a completely normal, unmodified, uncached network request.

Conclusion: the only things this service worker ever writes to or reads from a cache are the five static app-shell assets. No API response, no Supabase request/response, and no authenticated page HTML is ever cached, confirming compliance with the project's critical constraint.

## Build output

```
> next build
▲ Next.js 16.2.10 (Turbopack)
- Environments: .env.local
  Creating an optimized production build ...
✓ Compiled successfully in 3.7s
  Running TypeScript ...
  Finished TypeScript in 4.2s ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/23) ...
✓ Generating static pages using 9 workers (23/23) in 306ms
  Finalizing page optimization ...
```

Build succeeded with no type errors on the `appleWebApp` metadata field or the new `RegisterServiceWorker` import. Route list confirms `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` are all generated static routes (from Tasks 1-3), matching the paths referenced in `APP_SHELL`.

## Files changed

- `public/sw.js` (new)
- `public/offline.html` (new)
- `components/pwa/register-service-worker.tsx` (new)
- `app/layout.tsx` (modified — 3 additive hunks)

### `app/layout.tsx` diff region

```diff
 import { ThemeProvider } from "@/components/theme-provider";
 import { Toaster } from "@/components/ui/sonner";
+import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
 import { SPLASH_SKIP_SCRIPT } from "@/lib/splash";

@@
   robots: {
     index: true,
     follow: true,
   },
+  appleWebApp: {
+    capable: true,
+    statusBarStyle: "default",
+    title: "Cashly",
+  },
 };

@@
             {children}
             <Toaster richColors />
+            <RegisterServiceWorker />
           </ThemeProvider>
```

The CSP-nonce-sensitive inline `<script>` block (the splash-skip script, including its `nonce`, `suppressHydrationWarning`, and surrounding comments) was read in full before editing and left completely untouched — no changes were made to it, its position, or the `nonce`/`headers()` logic around it.

## Self-review findings

- Re-read `public/sw.js` fetch handler: confirmed cache-first behavior is scoped strictly to the fixed `APP_SHELL` array; navigate requests always hit network first with no `cache.put`; all other requests (API/Supabase/authenticated data) pass through with no `respondWith()` at all. No issues found.
- Diffed `app/layout.tsx` against the pre-edit read: only the three described additive changes are present. The CSP-nonce inline-script handling (lines ~86-98 in the original) is byte-for-byte unchanged.
- `npm run build` succeeds cleanly, TypeScript passes, and the icon/manifest routes referenced in `APP_SHELL` are confirmed present in the build's route list.

No concerns.

## Issues or concerns

None. Implementation matches the brief exactly; build is clean; cache-safety constraint verified by manual code walkthrough (no automated test exists for this task, as documented in the brief — covered by Task 6's manual verification instead).

## Note on this report file

`.superpowers/sdd/task-4-report.md` previously contained a report from an unrelated, earlier plan (Supabase clients/middleware work on branch `build/phase1-foundation`, commit `3c6f648`). That content did not belong to the current PWA-support plan and has been replaced with this report.

## Fix pass: auth-proxy PWA path gap

### Gap found

The auth proxy (`proxy.ts` → `lib/supabase/middleware.ts`'s `updateSession()`) 307-redirects any unauthenticated request to `/login` unless the path is in `PUBLIC_PATHS` or matches the proxy matcher's static-asset exclusion regex (`_next/static`, `_next/image`, `favicon.ico`, or paths ending in `.svg`/`.png`/`.jpg`/`.jpeg`/`.gif`/`.webp`).

None of the four PWA-shell routes added in Tasks 1-4 were covered by either mechanism:

- `/manifest.webmanifest` — not an excluded extension, not in `PUBLIC_PATHS`.
- `/apple-icon` — confirmed via build output to be served with no file extension, so the matcher's `.png` exclusion does not apply to it.
- `/sw.js` — not an excluded extension (`.js` isn't in the exclusion list), not in `PUBLIC_PATHS`.
- `/offline.html` — not an excluded extension, not in `PUBLIC_PATHS`.

(`/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` already end in `.png` and were already covered — no fix needed for those.)

Because the root layout (which references the manifest and mounts `RegisterServiceWorker`) wraps the entire app, including the public, unauthenticated marketing home page, an unauthenticated visitor's request for any of the four uncovered paths was redirected to `/login` instead of serving the actual asset. This broke PWA installability entirely for signed-out visitors: the browser couldn't fetch the manifest, the service worker script itself was unreachable, the iOS home-screen icon redirected instead of resolving, and the offline fallback page couldn't be precached. Not a security issue — none of these paths expose account/financial data — purely a functional bug.

### Fix applied

Added the four missing routes as exact-match entries to `PUBLIC_PATHS` in `lib/supabase/middleware.ts` (line 4). No changes to `isPublicPath`'s matching logic (exact match or `startsWith(p + "/")`), which already handles new entries correctly:

```ts
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/auth",
  "/terms",
  "/privacy",
  "/manifest.webmanifest",
  "/apple-icon",
  "/sw.js",
  "/offline.html",
];
```

### Verification

`npm test`:

```
 Test Files  8 passed (8)
      Tests  29 passed (29)
```

Matches the expected count (25 pre-existing + 2 `app/manifest.test.ts` + 2 `lib/pwa/is-ios.test.ts`).

`npm run build`:

```
✓ Compiled successfully in 3.9s
  Running TypeScript ...
  Finished TypeScript in 4.4s ...
✓ Generating static pages using 9 workers (23/23) in 307ms
```

Build succeeded with no errors. Route list still shows `/apple-icon`, `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` as static routes.

No automated test covers the middleware's redirect behavior itself (would require a running server + mocked Supabase session); per the brief, that's deferred to Task 6's manual verification pass — no new test infrastructure was added here.

### Commit

`fix(pwa): exempt manifest, icon, and service worker routes from auth redirect`
