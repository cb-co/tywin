# Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle, original sound effects (success, delete, error) to Cashly's core save/delete/error interactions, toggleable in Settings, defaulting to on.

**Architecture:** `use-sound` (a thin React hook over Howler.js) plays three short, self-synthesized WAV files. A `SoundProvider` React Context (same pattern as the existing `QuickAddProvider`) instantiates the three sounds once and exposes `playSuccess`/`playDelete`/`playError`, gated by a `localStorage`-persisted preference. Every existing `toast.success`/`toast.error` call site inside the authenticated app shell gets one additive sibling call to the matching `play*` function.

**Tech Stack:** `use-sound` + `howler` (new dependency), Node's built-in `fs`/`path` for WAV synthesis (no synthesis dependency), React Context, `localStorage`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-sound-effects-design.md`

## Global Constraints

- Three sounds only: success (light two-note ascending chime), delete (lower, distinct single tone), error (brief, low, calm — not alarming). Synthesized originals via a committed Node script, no external downloads.
- Preference key: `localStorage` `"cashly:sound-enabled"`, default **on** (`true`).
- Sound wiring is scoped to files that render inside the authenticated app shell. `components/auth/login-form.tsx` and `components/onboarding/welcome-flow.tsx` are explicitly out of scope.
- Classification rule: every `toast.error(...)` call gets a sibling `playError()`. Every `toast.success(...)` call gets `playDelete()` if it reports a genuine, irreversible deletion (a translation key containing "Deleted"), otherwise `playSuccess()` — this includes archive/restore, which are reversible.
- Only wire sound next to a call site that **already** shows a toast. Do not add new toasts or new sound cues to actions that are currently silent on success (e.g. inline budget-amount saves, the active/inactive toggle's success path, account deletion's success path before the hard navigation).
- No new dependency beyond `use-sound`, `howler`, and `@types/howler` (dev).

---

### Task 1: Dependencies and synthesized sound assets

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Create: `scripts/generate-sounds.mjs`
- Create: `public/sounds/success.wav`, `public/sounds/delete.wav`, `public/sounds/error.wav` (via running the script)
- Test: `scripts/generate-sounds.test.ts`

**Interfaces:**
- Produces: three static audio files at `/sounds/success.wav`, `/sounds/delete.wav`, `/sounds/error.wav`, served from `public/`. Task 2 references these paths by string literal — no code import.

- [ ] **Step 1: Install dependencies**

Run: `npm install use-sound howler`
Run: `npm install -D @types/howler`

Expected: `package.json` gains `use-sound` and `howler` under `dependencies`, `@types/howler` under `devDependencies`. `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

```ts
// scripts/generate-sounds.test.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const SOUND_FILES = ["success.wav", "delete.wav", "error.wav"];

for (const file of SOUND_FILES) {
  test(`public/sounds/${file} is a valid 44.1kHz mono 16-bit PCM WAV file`, () => {
    const path = join(process.cwd(), "public/sounds", file);
    expect(existsSync(path)).toBe(true);
    const buffer = readFileSync(path);
    expect(buffer.length).toBeGreaterThan(44);
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buffer.readUInt16LE(20)).toBe(1); // PCM format tag
    expect(buffer.readUInt16LE(22)).toBe(1); // mono
    expect(buffer.readUInt32LE(24)).toBe(44100); // sample rate
    expect(buffer.readUInt16LE(34)).toBe(16); // bits per sample
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: FAIL — all three assertions on `existsSync(path)` return `false` (the files don't exist yet).

- [ ] **Step 3: Write the generator script**

```js
// scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAMPLE_RATE = 44100;
const OUT_DIR = join(process.cwd(), "public/sounds");

function writeWavFile(path, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format tag
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
}

/** Quick fade-in, hold, fade-out — avoids clicks at buffer edges. */
function envelope(t, duration, attack = 0.01, release = 0.08) {
  if (t < attack) return t / attack;
  const releaseStart = duration - release;
  if (t > releaseStart) return Math.max(0, (duration - t) / release);
  return 1;
}

function tone(freq, duration, wave = "sine") {
  const numSamples = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * freq * t;
    const raw =
      wave === "sine" ? Math.sin(phase) : Math.asin(Math.sin(phase)) * (2 / Math.PI); // triangle
    samples[i] = raw * envelope(t, duration) * 0.5;
  }
  return samples;
}

function concat(...buffers) {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

// Success: light two-note ascending chime.
const success = concat(tone(660, 0.09, "sine"), tone(880, 0.12, "sine"));

// Delete: a lower, distinct single tone — not the same shape as success.
const del = tone(320, 0.16, "triangle");

// Error: brief, low, calm — two short pulses, not alarming.
const errorPulse = tone(240, 0.07, "sine");
const gap = new Float32Array(Math.round(SAMPLE_RATE * 0.05));
const error = concat(errorPulse, gap, errorPulse);

writeWavFile(join(OUT_DIR, "success.wav"), success);
writeWavFile(join(OUT_DIR, "delete.wav"), del);
writeWavFile(join(OUT_DIR, "error.wav"), error);

console.log("Generated public/sounds/{success,delete,error}.wav");
```

- [ ] **Step 4: Run the generator**

Run: `node scripts/generate-sounds.mjs`
Expected: prints `Generated public/sounds/{success,delete,error}.wav`; the three files now exist under `public/sounds/`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/generate-sounds.mjs scripts/generate-sounds.test.ts public/sounds/success.wav public/sounds/delete.wav public/sounds/error.wav
git commit -m "feat(sound): add use-sound dependency and synthesized UI sound assets"
```

---

### Task 2: Sound provider and app-shell mount

**Files:**
- Create: `components/sound/sound-provider.tsx`
- Modify: `components/shell/app-shell.tsx`

**Interfaces:**
- Consumes: `/sounds/success.wav`, `/sounds/delete.wav`, `/sounds/error.wav` (Task 1's output, referenced by URL string only).
- Produces: `useUiSound(): { playSuccess: () => void; playDelete: () => void; playError: () => void; enabled: boolean; setEnabled: (v: boolean) => void }` and `SoundProvider` from `components/sound/sound-provider.tsx`. Tasks 3–7 import `useUiSound` from this module; nothing else imports `SoundProvider` directly except this task's edit to `app-shell.tsx`.

No automated test for this task: `use-sound`/Howler touch browser audio APIs (`Audio`/`AudioContext`) unavailable in this repo's plain-Vitest setup (no jsdom) — the same constraint that already applied to the PWA work's service worker and install-prompt component. Verified via `npm run build` and Task 8's manual pass.

- [ ] **Step 1: Before writing the hook, confirm `use-sound`'s installed call signature**

Read `node_modules/use-sound/dist/index.d.ts` (or wherever the installed package's type declarations live — check `node_modules/use-sound/package.json`'s `types`/`main` field if that exact path doesn't exist) and confirm: the default export is a hook taking `(src: string, options?: { volume?: number, ... })` and returning a tuple whose first element is a `() => void` play function. This is the only part of the API this task relies on. If the installed version's shape differs from this, adapt Step 2 accordingly and note the discrepancy in your report — do not guess silently.

- [ ] **Step 2: Create the sound provider**

```tsx
// components/sound/sound-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import useSound from "use-sound";

const STORAGE_KEY = "cashly:sound-enabled";

type SoundContextValue = {
  playSuccess: () => void;
  playDelete: () => void;
  playError: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const Ctx = createContext<SoundContextValue | null>(null);

export function useUiSound() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUiSound must be used within SoundProvider");
  return ctx;
}

function readStoredPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  // Default true (on) is the safe SSR-compatible value — localStorage isn't
  // available during server rendering, so the real preference is read back
  // in the effect below, client-only, same pattern as the theme toggle.
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readStoredPreference());
  }, []);

  function setEnabled(v: boolean) {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* Non-fatal: the preference just won't persist across reloads. */
    }
  }

  const [rawPlaySuccess] = useSound("/sounds/success.wav", { volume: 0.5 });
  const [rawPlayDelete] = useSound("/sounds/delete.wav", { volume: 0.5 });
  const [rawPlayError] = useSound("/sounds/error.wav", { volume: 0.5 });

  function playSuccess() {
    if (enabled) rawPlaySuccess();
  }
  function playDelete() {
    if (enabled) rawPlayDelete();
  }
  function playError() {
    if (enabled) rawPlayError();
  }

  return (
    <Ctx.Provider value={{ playSuccess, playDelete, playError, enabled, setEnabled }}>
      {children}
    </Ctx.Provider>
  );
}
```

- [ ] **Step 3: Mount `SoundProvider` in the app shell**

Read `components/shell/app-shell.tsx` first to confirm it still matches the snippet below before editing.

Add the import alongside the other provider imports:

```tsx
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { SoundProvider } from "@/components/sound/sound-provider";
```

Wrap the existing `<QuickAddProvider>` with `<SoundProvider>`:

```tsx
  return (
    <SoundProvider>
      <QuickAddProvider>
        <Splash />
        <div className="flex min-h-dvh md:h-dvh md:overflow-hidden">
          <Sidebar
            email={user?.email ?? ""}
            displayName={profile?.display_name ?? null}
            avatarUrl={profileAvatarUrl(user?.user_metadata)}
          />
          <div className="flex flex-1 flex-col md:h-dvh md:overflow-y-auto">
            <MobileHeader />
            <main className="flex-1 p-4 pb-[calc(9rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
              {children}
            </main>
          </div>
          <BottomNav />
          <QuickAddButton />
          <QuickAddDialog data={quickAddData} />
        </div>
      </QuickAddProvider>
    </SoundProvider>
  );
```

- [ ] **Step 4: Build to confirm it type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/sound/sound-provider.tsx components/shell/app-shell.tsx
git commit -m "feat(sound): add SoundProvider and mount it in the app shell"
```

---

### Task 3: Settings toggle and settings-panel.tsx's own call sites

**Files:**
- Modify: `components/settings/settings-panel.tsx`
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Consumes: `useUiSound` from `@/components/sound/sound-provider` (Task 2).

No automated test (same browser-audio constraint as Task 2). Verified via `npm run build` and Task 8.

- [ ] **Step 1: Add imports and the hook call**

In `components/settings/settings-panel.tsx`, add to the existing import block:

```tsx
import { Switch } from "@/components/ui/switch";
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `SettingsPanel`, add alongside the other hooks (after `const tc = useTranslations("Common");`):

```tsx
  const { enabled, setEnabled, playSuccess, playError } = useUiSound();
```

- [ ] **Step 2: Wire `onSaveName`**

Replace:

```tsx
  function onSaveName() {
    if (!nameDirty) return;
    const next = name.trim();
    startNameTransition(async () => {
      const result = await updateDisplayName(next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSavedName(next);
      setName(next);
      toast.success(t("toastDisplayNameUpdated"));
      router.refresh();
    });
  }
```

with:

```tsx
  function onSaveName() {
    if (!nameDirty) return;
    const next = name.trim();
    startNameTransition(async () => {
      const result = await updateDisplayName(next);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      setSavedName(next);
      setName(next);
      toast.success(t("toastDisplayNameUpdated"));
      playSuccess();
      router.refresh();
    });
  }
```

- [ ] **Step 3: Wire `onCurrency`**

Replace:

```tsx
  function onCurrency(code: string) {
    setCurrency(code);
    startTransition(async () => {
      const result = await updateBaseCurrency(code);
      if (result.error) {
        toast.error(result.error);
        setCurrency(baseCurrency);
      } else {
        toast.success(t("toastCurrencyUpdated"));
        router.refresh();
      }
    });
  }
```

with:

```tsx
  function onCurrency(code: string) {
    setCurrency(code);
    startTransition(async () => {
      const result = await updateBaseCurrency(code);
      if (result.error) {
        toast.error(result.error);
        playError();
        setCurrency(baseCurrency);
      } else {
        toast.success(t("toastCurrencyUpdated"));
        playSuccess();
        router.refresh();
      }
    });
  }
```

- [ ] **Step 4: Wire `onDeleteAccount`'s error path**

Replace:

```tsx
  function onDeleteAccount() {
    startDeleteTransition(async () => {
      const result = await deleteAccount();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // The account and its session are gone — a hard navigation clears all
      // client state instead of letting the router refetch data for a user
      // that no longer exists.
      window.location.assign("/login");
    });
  }
```

with:

```tsx
  function onDeleteAccount() {
    startDeleteTransition(async () => {
      const result = await deleteAccount();
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      // The account and its session are gone — a hard navigation clears all
      // client state instead of letting the router refetch data for a user
      // that no longer exists.
      window.location.assign("/login");
    });
  }
```

(No sound on the success path — it's a hard navigation with no existing toast, and a sound would be cut off mid-playback anyway.)

- [ ] **Step 5: Add the Sound effects row and renumber the rows after it**

Replace:

```tsx
        <Row index={3} title={t("themeTitle")} description={t("themeDescription")}>
          <ThemeToggle />
        </Row>

        <Row index={4} title={t("categoriesTitle")} description={t("categoriesDescription")}>
          <Button variant="outline" size="sm" render={<a href="/budgets" />} nativeButton={false}>
            {t("manageCategoriesButton")}
          </Button>
        </Row>

        <Row index={5} title={t("sessionTitle")} description={t("sessionDescription")}>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" />
              {t("signOutButton")}
            </Button>
          </form>
        </Row>

        <InstallAppRow index={6} />
```

with:

```tsx
        <Row index={3} title={t("themeTitle")} description={t("themeDescription")}>
          <ThemeToggle />
        </Row>

        <Row
          index={4}
          title={t("soundEffectsTitle")}
          description={t("soundEffectsDescription")}
        >
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label={t("soundEffectsTitle")}
          />
        </Row>

        <Row index={5} title={t("categoriesTitle")} description={t("categoriesDescription")}>
          <Button variant="outline" size="sm" render={<a href="/budgets" />} nativeButton={false}>
            {t("manageCategoriesButton")}
          </Button>
        </Row>

        <Row index={6} title={t("sessionTitle")} description={t("sessionDescription")}>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" />
              {t("signOutButton")}
            </Button>
          </form>
        </Row>

        <InstallAppRow index={7} />
```

- [ ] **Step 6: Add English translations**

In `messages/en.json`, inside the `"Settings"` block, replace:

```json
    "themeTitle": "Theme",
    "themeDescription": "System, light, or dark.",
    "categoriesTitle": "Categories",
```

with:

```json
    "themeTitle": "Theme",
    "themeDescription": "System, light, or dark.",
    "soundEffectsTitle": "Sound effects",
    "soundEffectsDescription": "Light sounds for saves, deletes, and errors.",
    "categoriesTitle": "Categories",
```

- [ ] **Step 7: Add Spanish translations**

In `messages/es.json`, inside the `"Settings"` block, replace:

```json
    "themeTitle": "Tema",
    "themeDescription": "Sistema, claro u oscuro.",
    "categoriesTitle": "Categorías",
```

with:

```json
    "themeTitle": "Tema",
    "themeDescription": "Sistema, claro u oscuro.",
    "soundEffectsTitle": "Efectos de sonido",
    "soundEffectsDescription": "Sonidos sutiles al guardar, eliminar o si algo falla.",
    "categoriesTitle": "Categorías",
```

- [ ] **Step 8: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 9: Commit**

```bash
git add components/settings/settings-panel.tsx messages/en.json messages/es.json
git commit -m "feat(sound): add Settings toggle and wire settings-panel's own toasts"
```

---

### Task 4: Wire the transactions domain

**Files:**
- Modify: `components/transactions/ledger.tsx`
- Modify: `components/transactions/transaction-form.tsx`
- Modify: `components/accounts/account-activity.tsx`

**Interfaces:**
- Consumes: `useUiSound` from `@/components/sound/sound-provider` (Task 2).

No automated test (browser-audio constraint, same as Task 2/3).

- [ ] **Step 1: Wire `ledger.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `Ledger`, add alongside the other hooks (after `const tType = useTranslations("TransactionTypes");`):

```tsx
  const { playDelete, playError } = useUiSound();
```

Replace:

```tsx
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("transactionDeleted"));
        router.refresh();
      }
    });
  }
```

with:

```tsx
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("transactionDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }
```

- [ ] **Step 2: Wire `transaction-form.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `TransactionForm`, add alongside the other hooks (after `const isEdit = mode === "edit";`):

```tsx
  const { playSuccess, playError } = useUiSound();
```

Replace:

```tsx
    if (!(baseRate > 0)) {
      toast.error(t("rateInvalid"));
      return;
    }
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      toast.error(t("transferRateInvalid"));
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        exchange_rate: invertRate(baseRate),
        to_amount:
          isPayment && crossCurrency
            ? destinationAmount(Number(values.amount), transferRate)
            : undefined,
        to_account_id: isPayment ? values.to_account_id : "",
        category_id: values.type === "income" || values.category_id === "none" ? "" : values.category_id,
      };
      const result =
        isEdit && transaction
          ? await updateTransaction(transaction.id, payload)
          : await createTransaction(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? t("toastUpdated") : t("toastSaved"));
      onSuccess?.();
      router.refresh();
    });
```

with:

```tsx
    if (!(baseRate > 0)) {
      toast.error(t("rateInvalid"));
      playError();
      return;
    }
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        exchange_rate: invertRate(baseRate),
        to_amount:
          isPayment && crossCurrency
            ? destinationAmount(Number(values.amount), transferRate)
            : undefined,
        to_account_id: isPayment ? values.to_account_id : "",
        category_id: values.type === "income" || values.category_id === "none" ? "" : values.category_id,
      };
      const result =
        isEdit && transaction
          ? await updateTransaction(transaction.id, payload)
          : await createTransaction(payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(isEdit ? t("toastUpdated") : t("toastSaved"));
      playSuccess();
      onSuccess?.();
      router.refresh();
    });
```

- [ ] **Step 3: Wire `account-activity.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `AccountActivity`, add alongside the other hooks (after `const [pending, startTransition] = useTransition();`):

```tsx
  const { playDelete, playError } = useUiSound();
```

Replace:

```tsx
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("transactionDeleted"));
        router.refresh();
      }
    });
  }
```

with:

```tsx
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("transactionDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }
```

- [ ] **Step 4: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/transactions/ledger.tsx components/transactions/transaction-form.tsx components/accounts/account-activity.tsx
git commit -m "feat(sound): wire sound effects into the transactions domain"
```

---

### Task 5: Wire the accounts domain

**Files:**
- Modify: `components/accounts/account-detail-actions.tsx`
- Modify: `components/accounts/account-form-dialog.tsx`
- Modify: `components/accounts/reconcile-panel.tsx`

**Interfaces:**
- Consumes: `useUiSound` from `@/components/sound/sound-provider` (Task 2).

No automated test (browser-audio constraint, same as Task 2/3/4).

- [ ] **Step 1: Wire `account-detail-actions.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `AccountDetailActions`, add alongside the other hooks (after `const [confirmOpen, setConfirmOpen] = useState(false);`):

```tsx
  const { playSuccess, playDelete, playError } = useUiSound();
```

Replace:

```tsx
  function onArchive() {
    startTransition(async () => {
      const result = await archiveAccount(account.id, !account.is_archived);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(account.is_archived ? t("accountRestored") : t("accountArchived"));
      router.push("/accounts");
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("accountDeleted"));
      router.push("/accounts");
      router.refresh();
    });
  }
```

with:

```tsx
  function onArchive() {
    startTransition(async () => {
      const result = await archiveAccount(account.id, !account.is_archived);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(account.is_archived ? t("accountRestored") : t("accountArchived"));
      playSuccess();
      router.push("/accounts");
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("accountDeleted"));
      playDelete();
      router.push("/accounts");
      router.refresh();
    });
  }
```

(Archive and restore both go through `onArchive`'s single success branch, so both get `playSuccess()` — neither is a genuine deletion.)

- [ ] **Step 2: Wire `account-form-dialog.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `AccountFormDialog`, add alongside the other hooks (after `const tc = useTranslations("Common");`):

```tsx
  const { playSuccess, playError } = useUiSound();
```

Replace:

```tsx
  function onSubmit(values: FormValues) {
    startTransition(async () => {
      let cardGroupId = values.card_group_id;
      if (values.type === "credit_card" && cardGroupId === "new") {
        if (!newGroupName.trim()) {
          toast.error(t("toastNameGroupOrNone"));
          return;
        }
        const created = await createCardGroup(newGroupName.trim());
        if (created.error) {
          toast.error(created.error);
          return;
        }
        cardGroupId = created.id!;
      }
      const normalizedGroup = cardGroupId === "none" || cardGroupId === "new" ? "" : cardGroupId;

      let bankId = values.bank_id;
      if (bankId === "new") {
        if (!newBankName.trim()) {
          toast.error(t("toastNameBankOrNone"));
          return;
        }
        const created = await createBank(newBankName.trim());
        if (created.error) {
          toast.error(created.error);
          return;
        }
        bankId = created.id!;
      }
      const normalizedBank = bankId === "none" || bankId === "new" ? "" : bankId;

      const clean = Object.fromEntries(
        Object.entries({ ...values, card_group_id: normalizedGroup, bank_id: normalizedBank }).map(
          ([k, v]) => [k, v === "" ? undefined : v],
        ),
      ) as Record<string, unknown>;

      const result =
        mode === "create"
          ? await createAccount(clean as never)
          : await updateAccount(account!.id, clean as never);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? t("toastAccountAdded") : t("toastAccountUpdated"));
      setOpen(false);
      router.refresh();
    });
  }
```

with:

```tsx
  function onSubmit(values: FormValues) {
    startTransition(async () => {
      let cardGroupId = values.card_group_id;
      if (values.type === "credit_card" && cardGroupId === "new") {
        if (!newGroupName.trim()) {
          toast.error(t("toastNameGroupOrNone"));
          playError();
          return;
        }
        const created = await createCardGroup(newGroupName.trim());
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        cardGroupId = created.id!;
      }
      const normalizedGroup = cardGroupId === "none" || cardGroupId === "new" ? "" : cardGroupId;

      let bankId = values.bank_id;
      if (bankId === "new") {
        if (!newBankName.trim()) {
          toast.error(t("toastNameBankOrNone"));
          playError();
          return;
        }
        const created = await createBank(newBankName.trim());
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        bankId = created.id!;
      }
      const normalizedBank = bankId === "none" || bankId === "new" ? "" : bankId;

      const clean = Object.fromEntries(
        Object.entries({ ...values, card_group_id: normalizedGroup, bank_id: normalizedBank }).map(
          ([k, v]) => [k, v === "" ? undefined : v],
        ),
      ) as Record<string, unknown>;

      const result =
        mode === "create"
          ? await createAccount(clean as never)
          : await updateAccount(account!.id, clean as never);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAccountAdded") : t("toastAccountUpdated"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }
```

- [ ] **Step 3: Wire `reconcile-panel.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `ReconcilePanel`, add alongside the other hooks (after `const [balance, setBalance] = useState(String(currentBalance));`):

```tsx
  const { playSuccess, playError } = useUiSound();
```

Replace:

```tsx
  function onSetBalance() {
    const value = Number(balance);
    startTransition(async () => {
      const result = await setCardBalance(accountId, value);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("balanceUpdated"));
        router.refresh();
      }
    });
  }

  function onAddStatement(values: StatementForm) {
    startTransition(async () => {
      const result = await addCardStatement({ ...values, account_id: accountId });
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("statementRecorded"));
        reset();
        router.refresh();
      }
    });
  }
```

with:

```tsx
  function onSetBalance() {
    const value = Number(balance);
    startTransition(async () => {
      const result = await setCardBalance(accountId, value);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("balanceUpdated"));
        playSuccess();
        router.refresh();
      }
    });
  }

  function onAddStatement(values: StatementForm) {
    startTransition(async () => {
      const result = await addCardStatement({ ...values, account_id: accountId });
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("statementRecorded"));
        playSuccess();
        reset();
        router.refresh();
      }
    });
  }
```

- [ ] **Step 4: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/accounts/account-detail-actions.tsx components/accounts/account-form-dialog.tsx components/accounts/reconcile-panel.tsx
git commit -m "feat(sound): wire sound effects into the accounts domain"
```

---

### Task 6: Wire the subscriptions domain

**Files:**
- Modify: `components/subscriptions/subscription-form-dialog.tsx`
- Modify: `components/subscriptions/subscriptions-view.tsx`

**Interfaces:**
- Consumes: `useUiSound` from `@/components/sound/sound-provider` (Task 2).

No automated test (browser-audio constraint, same as prior tasks).

- [ ] **Step 1: Wire `subscription-form-dialog.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `SubscriptionFormDialog`, add alongside the other hooks (after `const tc = useTranslations("Common");`):

```tsx
  const { playSuccess, playError } = useUiSound();
```

Replace:

```tsx
  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = {
        ...values,
        account_id: values.account_id === "none" ? "" : values.account_id,
        category_id: values.category_id === "none" ? "" : values.category_id,
        anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
      };
      const result =
        mode === "create"
          ? await createSubscription(payload)
          : await updateSubscription(subscription!.id, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? t("toastAdded") : t("toastUpdated"));
      setOpen(false);
      router.refresh();
    });
  }
```

with:

```tsx
  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = {
        ...values,
        account_id: values.account_id === "none" ? "" : values.account_id,
        category_id: values.category_id === "none" ? "" : values.category_id,
        anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
      };
      const result =
        mode === "create"
          ? await createSubscription(payload)
          : await updateSubscription(subscription!.id, payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAdded") : t("toastUpdated"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }
```

- [ ] **Step 2: Wire `subscriptions-view.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `SubscriptionsView`, add alongside the other hooks (after `const [view, setView] = useState<"grid" | "table">("grid");`):

```tsx
  const { playSuccess, playDelete, playError } = useUiSound();
```

Replace:

```tsx
  function onAddCharge(id: string) {
    startTransition(async () => {
      const result = await addCharge(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("toastChargeLogged"));
        router.refresh();
      }
    });
  }
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("toastDeleted"));
        router.refresh();
      }
    });
  }
  function onToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setSubscriptionActive(id, active);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }
```

with:

```tsx
  function onAddCharge(id: string) {
    startTransition(async () => {
      const result = await addCharge(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("toastChargeLogged"));
        playSuccess();
        router.refresh();
      }
    });
  }
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("toastDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }
  function onToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setSubscriptionActive(id, active);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        router.refresh();
      }
    });
  }
```

- [ ] **Step 3: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/subscriptions/subscription-form-dialog.tsx components/subscriptions/subscriptions-view.tsx
git commit -m "feat(sound): wire sound effects into the subscriptions domain"
```

---

### Task 7: Wire the budgets domain

**Files:**
- Modify: `components/budgets/budget-grid.tsx`
- Modify: `components/budgets/category-dialog.tsx`

**Interfaces:**
- Consumes: `useUiSound` from `@/components/sound/sound-provider` (Task 2).

No automated test (browser-audio constraint, same as prior tasks).

- [ ] **Step 1: Wire `budget-grid.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `BudgetGrid`, add alongside the other hooks (after `const t = useTranslations("Budgets");`):

```tsx
  const { playSuccess, playDelete, playError } = useUiSound();
```

Replace:

```tsx
  function onSaveBudget(categoryId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === current) return;
    startTransition(async () => {
      const result = await setBudget({ category_id: categoryId, month, amount });
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("categoryDeleted"));
        router.refresh();
      }
    });
  }

  function onCopy() {
    startTransition(async () => {
      const result = await copyPreviousMonth(month);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("budgetsCopied"));
        router.refresh();
      }
    });
  }
```

with:

```tsx
  function onSaveBudget(categoryId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === current) return;
    startTransition(async () => {
      const result = await setBudget({ category_id: categoryId, month, amount });
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        router.refresh();
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("categoryDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }

  function onCopy() {
    startTransition(async () => {
      const result = await copyPreviousMonth(month);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("budgetsCopied"));
        playSuccess();
        router.refresh();
      }
    });
  }
```

(`onSaveBudget`'s success path has no existing toast — stays silent, no sound, per the Global Constraints scope rule.)

- [ ] **Step 2: Wire `category-dialog.tsx`**

Add to the imports:

```tsx
import { useUiSound } from "@/components/sound/sound-provider";
```

Inside `CategoryDialog`, add alongside the other hooks (after `const tc = useTranslations("Common");`):

```tsx
  const { playSuccess, playError } = useUiSound();
```

Replace:

```tsx
  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && category
          ? await updateCategory(category.category_id, payload)
          : await createCategory(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      setOpen(false);
      router.refresh();
    });
  }
```

with:

```tsx
  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && category
          ? await updateCategory(category.category_id, payload)
          : await createCategory(payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }
```

- [ ] **Step 3: Build to confirm everything type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/budgets/budget-grid.tsx components/budgets/category-dialog.tsx
git commit -m "feat(sound): wire sound effects into the budgets domain"
```

---

### Task 8: Manual verification pass

**Files:** none (verification only; fix-forward commits if issues are found).

This exercises the one thing no earlier task could cover with an automated test: that the sounds actually play at the right moments, sound distinct from each other, and respect the Settings toggle.

- [ ] **Step 1: Run the full test suite and a production build**

Run: `npm test && npm run build`
Expected: all tests pass (Task 1's 3 new WAV-validation tests plus the existing suite), build succeeds.

- [ ] **Step 2: Ask before starting the dev server**

Per this project's working agreement, confirm with the user before running `npm run dev` (or `next start`) to do the manual checks below.

- [ ] **Step 3: Verify each sound and the toggle**

With the app running and logged in: create a transaction (hear success), delete it (hear the distinct delete tone), submit an invalid form value like a zero exchange rate (hear the error tone). Repeat spot-checks in Subscriptions (add/delete) and Budgets (delete a category). Confirm the three sounds are audibly distinct from each other. Go to Settings, toggle "Sound effects" off, repeat one save and one delete, confirm silence; toggle back on, confirm sound returns. Reload the page after toggling off and confirm the preference persisted (still off).

- [ ] **Step 4: Fix forward if anything above fails**

If any check fails, fix the relevant file from Tasks 1–7, re-run the affected check, and commit the fix with a message describing what was wrong.

- [ ] **Step 5: Push**

```bash
git push
```
