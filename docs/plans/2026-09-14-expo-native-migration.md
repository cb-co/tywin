# Cashly native app (Expo) — migration plan

Date: 2026-09-14
Status: proposal. Nothing is built yet.

## Goal

Ship Cashly as a real iOS and Android app built with Expo. The native app goes in a **new repo** (`tywin-native`).
This repo stays as the web app and **becomes the backend** for everything a phone must not do itself.
Both apps share the Supabase project that is already live.

## Decisions this plan rests on

1. **Stay on Supabase.** See "Backend verdict" at the end. The native app gets the most out of it:
   supabase-js runs in React Native, and the 126 `auth.uid()` RLS checks already isolate every user.
   So most reads and simple writes can go straight from the phone to Postgres, with no API layer.
2. **Split into two lanes.**
   - **Direct lane (phone → Supabase under RLS):** table reads, the 12 RPCs, and plain CRUD
     (accounts, transactions, budgets, goals, recurring, rules, settings).
   - **Server lane (phone → Next.js `/api/v1/*` with a bearer JWT):** anything that needs a secret
     or heavy Node code. That covers statement import (pdfjs + `@napi-rs/canvas` + Gemini),
     `/api/ask` (Gemini), the daily recommendation ("today's take"), and owner-model routing (`OWNER_EMAIL`).
3. **Separate repo, and copy the shared code at first.** Pure TS in `lib/` (format, fx, period, money-parts, palette,
   color, statements/validate, the zod schemas) gets copied into `tywin-native/src/core`. Once the two
   copies start drifting, move it into a shared package (npm workspace or git submodule).
   `types.ts` is regenerated in each repo with `supabase gen types --linked`.
4. **Keep the web PWA/TWA running** while the native app catches up. Retire the TWA only after the Play Store
   build reaches parity.
5. **Offline is level 1 at launch:** screens you've already loaded stay viewable, and quick-add works offline
   and syncs later. There is no local database copy. Data access goes through a repository layer, so
   a later move to a full local database (e.g. PowerSync) only has to change that layer. See "Offline support".

## Inventory (what gets migrated)

| Area | Today (web) | Native landing |
|---|---|---|
| Routes | 13 app screens + login, welcome, terms, privacy | Expo Router, same tree (`[id]/page.tsx` → `[id].tsx`) |
| Data | 190 `.from()` calls, mostly in async Server Components | Client hooks with TanStack Query + supabase-js |
| Mutations | 54 server actions in 14 files | Direct supabase-js writes or RPCs. Secret or heavy ones go to `/api/v1` |
| Auth | Cookie session (`@supabase/ssr`): password + Google OAuth | supabase-js with session in `expo-secure-store`. Native Google sign-in + **Sign in with Apple** |
| i18n | next-intl, `messages/{en,es}` | `use-intl` (next-intl's core, runs in RN) reading the same JSON |
| Charts | recharts (DOM only) | `victory-native` (Skia). DOM component as a stopgap |
| Theme | next-themes, CSS tokens | `useColorScheme` + a token file ported from the palette |
| Sound | howler / use-sound | `expo-audio` |
| Markdown (Ask) | react-markdown | Hybrid: native chat list, markdown rendered in a DOM component |
| PDF upload | `<input type=file>` → server action | `expo-document-picker` → multipart POST to `/api/v1/statements` |
| Storage | localStorage (`use-stored-boolean`) | `expo-sqlite/localStorage/install` polyfill |

## Phase 0 — Prepare the backend (this repo, ~1 week)

The web keeps working the whole time. Each item is its own small PR.

1. **Bearer-aware `createClient()`** (`lib/supabase/server.ts`): one decision point, so every server action
   and query serves a bearer token unchanged. The proxy passes bearer `/api/*` calls through to the route.
   No service extraction is needed. Done in `docs/plans/2026-09-14-native-phase0-api-v1.md`.
2. **`/api/v1`**: statements parse/confirm, recommendation, fx, ask. Contract and the lane map for all 54
   server actions are in `docs/native-api.md`. Endpoints for the other server-lane actions land with their screen in Phase 3.
3. **Server-lane invariants**: the lane map records which actions compute or re-derive values in TS. Those
   stay server-lane (or move into Postgres later via a migration the user pushes).
4. **Rate limits** on `/api/v1/statements` and `/api/v1/ask`, per user. Gemini cost is the real scaling risk,
   not the database. Done for statement parsing and Ask.

## Phase 1 — Scaffold (new repo, ~2–3 days)

1. `npx create-expo-app@latest tywin-native` on the latest SDK, with Expo Router and TypeScript.
2. Mirror the routes: `(auth)/login`, `(auth)/welcome`, `(app)/_layout` with **NativeTabs**
   (Overview · Transactions · Budgets · Accounts · More), plus stacks for `accounts/[id]`, `imports/[id]`,
   `budgets/goals/[id]`, `recurring`, `insights`, `ask`, `settings`, `settings/rules`, `help`, `terms`, `privacy`.
3. Providers in the root layout: QueryClient, IntlProvider (locale from device, overridable in settings),
   theme, SafeArea, Supabase session gate.
4. `src/lib/supabase.ts`: `createClient` with `auth.storage` = SecureStore adapter,
   `autoRefreshToken`, `detectSessionInUrl: false`, and an `AppState` listener that starts and stops refresh.
5. **Repository layer** `src/data/`: one hook per concept (`useTransactions`, `useSafeToSpend`,
   `useAccounts`, `useAddTransaction`…). **Screens never import supabase-js directly.** That is the seam
   a later local-first move swaps out.
6. Copy `lib` core + `types.ts`. Port the vitest suites alongside (run them with jest-expo or vitest).
7. EAS: `eas init`, `development`/`preview`/`production` profiles, bundle IDs, icons from `app/icon-*.png`.

## Phase 2 — Auth + day-one shell (~1 week)

1. **Supabase Auth config:** add the native redirect scheme (`cashly://auth-callback`), enable the Apple provider,
   and add the iOS/Android Google client IDs for `signInWithIdToken`. Needs the app's bundle/package ID.
2. **Account deletion** already exists (`delete_own_account` RPC — see the lane map in `docs/native-api.md`).
   Wire it into native Settings too, because both stores require in-app account deletion.
3. Native auth screens (password sign-in/up, Google via `@react-native-google-signin/google-signin`
   → `supabase.auth.signInWithIdToken`, Apple via `expo-apple-authentication` → `signInWithIdToken`).
   **Apple sign-in is required on iOS** when Google login is offered (App Store guideline 4.8).
4. Onboarding (`welcome`) native, because it drives activation.
5. Every other screen starts as a **DOM component** (`'use dom'`), fed data fetched in its native parent.
   Before a screen can move, split its async Server Component into a client fetch plus a presentational component.
   This is the "runs on a phone" milestone. Ship it to TestFlight / internal testing only, not to the store:
   a mostly-webview app risks App Store rejection under guideline 4.2.

## Phase 3 — Nativize screens in order of value (~4–6 weeks, one screen per pass)

Order follows the activation event (*first statement imported*) and daily use:

| # | Screen | Bucket | Notes |
|---|---|---|---|
| 1 | Statement import (from Accounts) | nativize-now | Document picker, upload progress, `imports/[id]` review with swipe-to-recategorize |
| 2 | Overview (`/`) | nativize-now | Safe-to-spend until next quincena, today's take; pull-to-refresh |
| 3 | Transactions + quick-add | nativize-now | FlashList, sheet for quick-add, haptics, swipe actions |
| 4 | Accounts + `accounts/[id]` | nativize-now | Card-as-physical-object rendering (Skia or SVG), card report |
| 5 | Budgets, groups, goals | nativize-now | Progress rings, form sheets |
| 6 | Recurring | nativize-later | List + form sheet |
| 7 | Insights | hybrid → native | Charts go to victory-native last |
| 8 | Ask | hybrid | Native input and list, streamed markdown in a DOM component |
| 9 | Settings, rules | nativize-later | `@expo/ui` form rows |
| 10 | Help, terms, privacy | port-as-is | Stay DOM, or open in `expo-web-browser` |

For each screen: use `@expo/ui` (SwiftUI/Compose) first and RN primitives only for custom visuals.
Pull en+es copy from `messages/`, keep the help guide in step (see help-guide upkeep), and check parity
against the running web route (content and behavior, not pixels). Track progress in `migration-progress.md`
in the native repo.

## Offline support — level 1 (~1 week, before launch)

Scope: the app stays useful with bad or no signal. **Not in scope:** a local copy of the whole database,
recalculating balances offline, statement import, or Ask offline.

1. **Saved screen data.** `@tanstack/react-query-persist-client` with a persister backed by
   `expo-sqlite/kv-store` (or MMKV). On launch, show saved data right away, then refresh.
   - `gcTime` of ~7 days so screens survive a restart. `networkMode: 'offlineFirst'` for queries.
   - `onlineManager` wired to `@react-native-community/netinfo`, and `focusManager` to `AppState`.
   - **Clear the saved data on sign-out and on account switch.** It holds financial data for one user.
   - Save under a key that includes the user id and an app-schema version, so a release that changes query shapes
     throws away old saved data instead of crashing on it.
2. **"As of" freshness.** When offline or showing saved data, screens with money figures (Overview safe-to-spend,
   account balances, budgets) show a quiet "Offline · as of 10:42" badge built from `dataUpdatedAt`. Refresh and
   buttons that need the network are disabled with a reason, not hidden.
3. **Queued quick-add.** Only transaction creation is queued. Other mutations are blocked offline with a message.
   - Generate the transaction `id` (uuid v7) on the device, so a replayed insert is idempotent (`upsert` on `id`,
     or `on conflict do nothing`). Check that `transactions.id` accepts a client-supplied uuid.
   - Use React Query's paused mutations (`mutationKey` + `setMutationDefaults` so they survive a restart via
     the persister), plus an optimistic insert into the cached transactions list marked "pending sync".
   - When back online: `resumePausedMutations()`, then invalidate balances, safe-to-spend, budgets and transactions
     so the server recalculates them.
   - If a queued insert fails for good (RLS, a check constraint, a deleted account): keep it visible as
     "couldn't sync" with retry/edit/discard. Never drop it silently.
4. **Statement import offline:** the document picker still opens, but upload says it needs a connection.
   No queueing of PDFs at level 1.
5. **Copy:** en+es strings for offline badge, pending-sync, sync-failed; add a short help-guide entry.
6. **Verify:** airplane mode on a device. Cold start shows saved screens. Add 3 expenses offline, kill the app,
   reopen, go online. All 3 land exactly once and balances refresh. Sign out: saved data is gone.

Later (only if users ask): level 2 (a local read-only SQLite copy for full search) or level 3 (PowerSync local-first,
with the view and RPC math ported to the device). The repository layer from Phase 1 keeps both options open.

## Phase 4 — Native-only value (~1–2 weeks, optional before launch)

- **Push notifications** (`expo-notifications`): card due dates, "quincena landed, here's what's safe",
  budget crossing. Needs a `push_tokens` table (RLS) and a scheduled sender (Supabase Cron + Edge Function,
  or a Vercel cron route).
- **Share extension / "Open in Cashly"** for statement PDFs from the bank app or email. This is the biggest
  activation win native offers.
- **Home-screen widget** for safe-to-spend (later).
- Biometric app lock (`expo-local-authentication`). A finance app is expected to have one.

## Phase 5 — Ship (~1 week plus store review)

1. `eas build` production for both platforms. `eas submit` to TestFlight and Play internal testing.
2. Store listings in es-DO + en: privacy nutrition labels (financial info, email), a data-deletion URL
   (`/privacy`), and a demo account for reviewers with a pre-imported statement.
3. EAS Update channels for OTA JS fixes. Bump the runtime version whenever native deps change.
4. Crash and perf monitoring (Sentry or EAS Observe).
5. **Monetization note:** if Cashly ever charges for features inside the app, both stores require IAP
   (RevenueCat), not Stripe. Decide this before the first paid feature, not at review.

## Risks

| Risk | Mitigation |
|---|---|
| Server-action invariants bypassed by direct writes | Phase 0 step 3. The DB enforces them, or the write stays server-lane |
| Gemini cost/quota at 10k users | Per-user rate limits, cache today's take per day, keep flash-lite as default |
| Two copies of `lib` drift | Extract a shared package the first time a fix has to land twice |
| Schema change breaks an older installed app | Additive migrations only; keep views/RPCs backward compatible for one release cycle |
| Offline saved data shows stale money figures as current | "As of" badge on every money figure shown from saved data |
| Queued quick-add duplicates or gets lost | Device-generated uuid + idempotent insert; failed queue items stay visible |
| Guideline 4.2 rejection | Don't submit until the top 5 screens are native |

## Rough timeline

Solo dev, part time: Phase 0–2 ≈ 3 weeks, Phase 3 ≈ 5 weeks, offline level 1 ≈ 1 week, Phase 4–5 ≈ 2–3 weeks → **public store launch in about 11–12 weeks**.

---

## Backend verdict: Neon vs Supabase

**Stay on Supabase.** At about 10k users the database isn't the constraint, and switching means rebuilding
auth and the whole data-access layer for no user-visible gain, just before a native launch that
leans directly on supabase-js + RLS.

What Supabase does for this app today: Postgres, Auth (password + Google), PostgREST (190 `.from()` calls),
RLS keyed on `auth.uid()` (126 references), 12 RPCs including the `security invoker` `ask_query`,
the migration CLI and type generation. It does not use Storage (the bucket was dropped), Realtime, or Edge Functions.

| | Supabase | Neon |
|---|---|---|
| Postgres | Managed, fixed compute size (upgrade by instance) | Serverless, autoscaling, scale-to-zero, instant branching |
| Auth | Built in, mature, native `signInWithIdToken` for Apple/Google | Neon Auth (Better Auth based), younger |
| Client API | PostgREST + supabase-js, works on web and React Native | Data API (PostgREST-compatible) exists, but less mature; usually you add Drizzle/Prisma plus your own API |
| RLS with user identity | `auth.uid()` everywhere, works as-is | Possible via JWT claims (`pg_session_jwt`); every policy has to be rewritten |
| Branching / preview DBs | Branching exists, heavier | Best in class, copy-on-write branch per PR |
| Extras | Storage, Realtime, Edge Functions, Cron, Queues in one project | Database only; you assemble the rest (Blob, cron, etc.) |
| Cost at ~10k users | Pro plan base covers 100k MAU; likely a compute add-on as load grows | Usage-based, cheap when idle; auth and other pieces billed separately |
| Lock-in | Postgres is portable; Auth and PostgREST coupling is the sticky part | Plain Postgres, very portable |

Neon wins when you want per-PR database branches, spiky or idle workloads that benefit from scale-to-zero,
or you already own the API and auth layers. None of that describes Cashly now.

Switch cost for this repo: replace 27 `auth.getUser` sites plus the OAuth callback, rewrite 126 `auth.uid()`
policy references, replace or re-verify 190 query-builder calls, migrate existing users' password hashes
and Google identities, and redo the native auth story. That's weeks of work with no user-facing change.

Things that matter more for 10k users than the vendor:
- Gemini cost and quota per import and per Ask question (rate limits, caching).
- Indexes on `transactions(user_id, date)` and the derived views that power range RPCs.
  Check them with `explain analyze` on a seeded 10k-user dataset.
- The Supabase compute tier (step up when CPU or memory stays high), plus PITR backups for financial data.
- Enabling leaked-password protection and MFA options in Auth.

Revisit Neon only if Supabase pricing or reliability becomes a real problem later. Postgres portability keeps that door open.
