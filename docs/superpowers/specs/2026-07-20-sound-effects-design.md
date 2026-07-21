# Sound Effects — Design

Sub-project 2 of 2 (mobile-availability effort). Sub-project 1 was PWA
support (shipped). Capacitor wrapping is a later, unspecced phase that
depends on both of these.

## Goal

Add subtle, tasteful sound effects to Cashly's core interactions — saving,
deleting, and errors — so the app feels more alive, without being
distracting or out of place in a finance app that gets used in quiet/public
settings.

## Non-goals

- Navigation/tap sounds (bottom nav, sidebar links, buttons) — explicitly
  excluded; the highest-frequency interaction category, and the user chose
  not to include it.
- Sound in the pre-app-shell auth/onboarding flow (`/login`, `/welcome`) —
  these routes render outside the app shell the sound provider mounts in,
  and adding sound to a sign-in/sign-up funnel doesn't serve "make the app
  feel alive."
- Sourcing real recorded/licensed audio — no internet fetch of binary
  assets, no guessed URLs. Sounds are synthesized originals.
- Server-persisted sound preference — client-only, same tier as the theme
  toggle, not a new database column.

## Sound identity

Three short, original, synthesized tones (soft sine/triangle waves with an
envelope, no external assets), matching the calm ivory/emerald brand rather
than game-style SFX:

- **Success** (`public/sounds/success.wav`): a light two-note ascending
  chime — confirms a save/update/creation completed.
- **Delete** (`public/sounds/delete.wav`): a lower, distinct single tone —
  confirms a genuine, irreversible deletion. Archive/restore actions are
  reversible and use the success sound instead, not this one.
- **Error** (`public/sounds/error.wav`): a brief, low, calm tone — signals a
  failure without being alarming.

Generated once via a Node script (`scripts/generate-sounds.mjs`) that writes
real WAV files (raw PCM synthesis with a fade-in/out envelope, no audio
library dependency needed for generation itself). The script is committed
alongside the generated files so the sounds can be regenerated/retuned
later; it is not run as part of the app's build.

## Dependency

`use-sound` (a thin React hook over Howler.js) for playback — the standard
choice for short UI sound effects in a React app: tiny, handles
preloading/volume, no manual `<audio>` element management.

## Architecture

`components/sound/sound-provider.tsx` — a React Context provider following
the same pattern as the existing `QuickAddProvider`
(`components/quick-add/quick-add-provider.tsx`):

- Calls `useSound()` once per sound file (three total) at the provider's top
  level — not re-instantiated per call site.
- Reads/writes a `localStorage` boolean preference (key
  `cashly:sound-enabled`), default `true` (on). Same client-only persistence
  tier as the theme toggle (`next-themes`) — no Supabase profile column.
- Exposes `useUiSound()`: `{ playSuccess, playDelete, playError, enabled,
  setEnabled }`. When `enabled` is `false`, the three `play*` functions are
  no-ops (checked inside the provider, not at every call site).
- Mounted once in `components/shell/app-shell.tsx`, alongside the existing
  `QuickAddProvider` — the app shell is the boundary for "this app is
  alive," and every current call site that needs sound already renders
  inside it.

## Settings UI

A new row in `components/settings/settings-panel.tsx` (using the `Row`
component already extracted to `components/settings/row.tsx` during the PWA
work), positioned next to the existing Theme row, with a toggle bound to
`useUiSound()`'s `enabled`/`setEnabled`. New i18n strings in both
`messages/en.json` and `messages/es.json`.

## Call-site wiring

At each existing `toast.success`/`toast.error` call site inside the app
shell, add one sibling call to the matching `play*` function — additive,
the existing toast call is untouched. Scope (11 files, ~30 call sites,
enumerated precisely in the implementation plan):

- `components/transactions/ledger.tsx`
- `components/transactions/transaction-form.tsx`
- `components/subscriptions/subscription-form-dialog.tsx`
- `components/subscriptions/subscriptions-view.tsx`
- `components/accounts/account-activity.tsx`
- `components/accounts/account-detail-actions.tsx`
- `components/accounts/account-form-dialog.tsx`
- `components/accounts/reconcile-panel.tsx`
- `components/settings/settings-panel.tsx`
- `components/budgets/budget-grid.tsx`
- `components/budgets/category-dialog.tsx`

Classification rule: every `toast.error` call gets `playError()`. Every
`toast.success` call gets `playDelete()` if the action was a genuine,
irreversible deletion (translation keys containing "Deleted"), otherwise
`playSuccess()` — this covers saves, updates, creations, and reversible
state changes like archive/restore.

`components/auth/login-form.tsx` and `components/onboarding/welcome-flow.tsx`
are explicitly out of scope (see Non-goals).

## Testing

- No automated test for `sound-provider.tsx` itself: `use-sound`/Howler
  touch browser audio APIs (`Audio`/`AudioContext`) that don't exist in this
  repo's plain-Vitest setup (no jsdom, same constraint that already applied
  to the PWA work's service worker and install-prompt component). Manual
  verification only, same as those.
- The classification rule (delete vs. success vs. error per call site) is a
  fixed per-site choice baked into the plan, not runtime logic — nothing to
  unit test there.
- `npm run build` succeeds with the new dependency and all wired call sites
  type-checking.
- Manual verification: toggle sound on/off in Settings and confirm each of
  the three sounds plays at the right moment (save, delete, error) and
  respects the toggle.
