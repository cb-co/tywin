# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a themed, authenticated, mobile-first Next.js + Supabase app shell that a user can log into and navigate, ready for feature phases to build on.

**Architecture:** Next.js App Router (Server Components + Server Actions), Supabase Auth via `@supabase/ssr` (cookie sessions, refreshed in middleware), route protection in middleware, `next-themes` for system/light/dark theming with semantic Tailwind tokens, and a responsive shell (bottom nav on mobile → sidebar on desktop) with a Quick-Add entry point.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, `@supabase/ssr` + `@supabase/supabase-js`, `next-themes`, `lucide-react`, `sonner`.

## Global Constraints

- **Framework:** Next.js App Router, TypeScript, Server Components for reads and Server Actions for all mutations. No client-side data mutations.
- **Auth/DB:** Supabase Auth + Postgres; use the RLS-enforcing anon client in user paths, never the service role.
- **Money:** stored as `numeric` (no floats); rendered with tabular numerals. (Not exercised in Phase 1 but tokens/utilities must not preclude it.)
- **Theming:** light + dark, **default system**, persisted manual toggle, no flash-of-wrong-theme. All colors are semantic tokens.
- **Mobile-first:** every layout designed for phone first; bottom nav on mobile, sidebar at `md` and up.
- **Base currency:** profile default `USD` (schema arrives Phase 2; not created here).
- **Spec:** `docs/specs/2026-07-16-financial-tracker-design.md`.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: project root files via `create-next-app` (`package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `eslint.config.mjs`, `postcss.config.mjs`).

**Interfaces:**
- Consumes: nothing (greenfield).
- Produces: a runnable Next.js app with Tailwind v4 available; `@/*` path alias mapped to project root.

- [ ] **Step 1: Scaffold into the current directory**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 3: Verify the dev server boots**

Run: `npm run dev` then open `http://localhost:3000`.
Expected: default Next.js page renders. Stop the server (Ctrl-C) after confirming.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

---

### Task 2: Initialize shadcn/ui and base components

**Files:**
- Create/Modify: `components.json`, `lib/utils.ts` (the `cn` helper), `app/globals.css` (shadcn base layer), and `components/ui/*` for the added primitives.

**Interfaces:**
- Consumes: Task 1 app.
- Produces: `cn(...classes)` from `@/lib/utils`; UI primitives `Button`, `Card`, `Dialog`, `Input`, `Label`, `Sonner` (`Toaster`) under `@/components/ui/*`.

- [ ] **Step 1: Init shadcn (choose Neutral base color when prompted, defaults otherwise)**

```bash
npx shadcn@latest init -d
```

- [ ] **Step 2: Add the base primitives used by the shell and auth**

```bash
npx shadcn@latest add button card dialog input label sonner dropdown-menu
```

- [ ] **Step 3: Verify build compiles with the new components**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui with base components"
```

---

### Task 3: Theming — system/light/dark with semantic tokens, no FOUC

**Files:**
- Create: `components/theme-provider.tsx`, `components/theme-toggle.tsx`.
- Modify: `app/layout.tsx` (wrap in provider, `suppressHydrationWarning`), `app/globals.css` (confirm `.dark` token block exists from shadcn; fix the self-referential `--font-sans`).

**Interfaces:**
- Consumes: `Button`, `DropdownMenu` from Task 2 — these are the **Base UI** (`@base-ui/react`) shadcn variant. Composition uses the **`render` prop**, NOT Radix's `asChild`.
- Produces: `<ThemeProvider>` wrapping the app; `<ThemeToggle />` cycling system/light/dark; `next-themes` `useTheme()` available app-wide.

> **Base UI note:** the installed shadcn components are Base UI-based. Where Radix would use `<Trigger asChild><Button/></Trigger>`, Base UI uses `<Trigger render={<Button/>}>{children}</Trigger>` — the trigger's children render inside the element passed to `render`. `lucide-react` v1 exports both `Moon` and `MoonIcon`; the bare names used below are valid.

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 2: Create the theme provider**

Create `components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
```

- [ ] **Step 3: Wrap the root layout (no-FOUC)**

Edit `app/layout.tsx` so `<html>` has `suppressHydrationWarning` and the body is wrapped:

```tsx
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// inside RootLayout return:
// <html lang="en" suppressHydrationWarning>
//   <body className={/* existing font classes */}>
//     <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
//       {children}
//       <Toaster richColors />
//     </ThemeProvider>
//   </body>
// </html>
```

Then fix the self-referential font token left by shadcn init in `app/globals.css`: inside the `@theme inline` block, change `--font-sans: var(--font-sans);` to `--font-sans: var(--font-geist-sans);` (and, if present, `--font-mono: var(--font-mono);` to `--font-mono: var(--font-geist-mono);`) so the app uses the Geist fonts defined in `app/layout.tsx`.

- [ ] **Step 4: Create the theme toggle**

Create `components/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Toggle theme" />}
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, temporarily drop `<ThemeToggle />` into `app/page.tsx`, and confirm switching Light/Dark/System changes the palette with no white flash on reload. Remove the temporary placement afterward. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add system/light/dark theming with no-FOUC toggle"
```

---

### Task 4: Supabase clients and session middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `.env.local` (local, git-ignored), `.env.example`.

**Interfaces:**
- Consumes: env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's current publishable-key naming; the value is a client-safe `sb_publishable_...` key). `.env.local` already exists with real values.
- Produces:
  - `createClient()` (browser) from `@/lib/supabase/client`.
  - `createClient()` (async, server) from `@/lib/supabase/server` — RLS-enforcing, cookie-bound.
  - `updateSession(request)` from `@/lib/supabase/middleware` returning a `NextResponse` and redirecting unauthenticated users to `/login`.

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Add env files**

Create `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` already exists at the repo root with the real project URL + publishable key (created by the controller) and is git-ignored. Do NOT overwrite it. For `.env.example` to be committable, add a negated ignore rule to `.gitignore` (`!.env.example`) since create-next-app ignores `.env*`.

- [ ] **Step 3: Browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 4: Server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; safe to ignore — middleware refreshes.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: Middleware session helper + route protection**

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
```

Create `middleware.ts` (project root):

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients and session middleware with route protection"
```

---

### Task 5: Authentication — login/signup, callback, sign-out

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `components/auth/login-form.tsx`.

**Interfaces:**
- Consumes: `createClient()` (server) from Task 4; `Button`, `Input`, `Label`, `Card` from Task 2; `toast` from `sonner`.
- Produces: server actions `signIn(formData)` and `signUp(formData)` from `@/app/login/actions`; a working `/login` route; `GET /auth/callback` (code exchange) and `POST /auth/signout`.

- [ ] **Step 1: Auth server actions**

Create `app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: error.message };
  return { success: true };
}
```

- [ ] **Step 2: Login form (client component with pending + error states)**

Create `components/auth/login-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn, signUp } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"in" | "up">("in");

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const action = mode === "in" ? signIn : signUp;
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
      else if (mode === "up") toast.success("Check your email to confirm your account.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Login page**

Create `app/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your finance tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Auth callback + sign-out routes**

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
```

Create `app/auth/signout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
```

- [ ] **Step 5: Verify the auth flow end-to-end**

Run: `npm run dev`. Visit `/` while logged out → expect redirect to `/login`. Sign up with a test email, confirm via Supabase (or disable email confirmation in the Supabase project for dev), sign in → expect redirect to `/`. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add email/password auth with login, callback, and sign-out"
```

---

### Task 6: Responsive app shell — bottom nav (mobile) → sidebar (desktop)

**Files:**
- Create: `lib/nav.ts`, `components/shell/app-shell.tsx`, `components/shell/sidebar.tsx`, `components/shell/bottom-nav.tsx`, `components/shell/nav-link.tsx`, `app/(app)/layout.tsx`, `app/(app)/page.tsx` (Overview placeholder), and placeholder pages `app/(app)/accounts/page.tsx`, `app/(app)/transactions/page.tsx`, `app/(app)/budgets/page.tsx`, `app/(app)/subscriptions/page.tsx`, `app/(app)/insights/page.tsx`, `app/(app)/settings/page.tsx`.
- Delete: `app/page.tsx` (default home; replaced by the `(app)` group).

**Interfaces:**
- Consumes: `createClient()` (server), `ThemeToggle`, `cn`, lucide icons.
- Produces: `NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[]` from `@/lib/nav`; `<AppShell>` server component wrapping children with responsive nav and rendering the signed-in user's email.

- [ ] **Step 1: Nav config as a pure module (with a test)**

Create `lib/nav.ts`:

```ts
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Repeat,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

Create `lib/nav.test.ts`:

```ts
import { expect, test } from "vitest";
import { NAV_ITEMS } from "./nav";

test("nav items have unique, root-absolute hrefs", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  expect(hrefs).toContain("/");
});
```

- [ ] **Step 2: Install and configure the test runner, then verify the test fails, then passes**

```bash
npm install -D vitest
npm pkg set scripts.test="vitest run"
```

Run: `npm test`
Expected: PASS (2 items). (Written test-first per TDD; it passes immediately because `NAV_ITEMS` already exists — this task's risk is the shell wiring, verified below.)

- [ ] **Step 3: Active-aware nav link**

Create `components/shell/nav-link.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

export function NavLink({ item, variant }: { item: NavItem; variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        variant === "side" && "px-3 py-2 hover:bg-accent hover:text-accent-foreground",
        variant === "bottom" && "flex-col gap-1 px-2 py-1.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
        variant === "side" && active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn(variant === "bottom" && "text-[10px]")}>{item.label}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Sidebar (desktop) and bottom nav (mobile)**

Create `components/shell/sidebar.tsx`:

```tsx
import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">Finance</div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} variant="side" />
        ))}
      </nav>
      <div className="flex items-center justify-between border-t p-3">
        <span className="truncate text-xs text-muted-foreground">{email}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
```

Create `components/shell/bottom-nav.tsx`:

```tsx
import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";

// Show the 5 most-used destinations on the mobile bottom bar.
const MOBILE_ITEMS = NAV_ITEMS.filter((i) =>
  ["/", "/accounts", "/transactions", "/budgets", "/insights"].includes(i.href),
);

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-card/95 backdrop-blur md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} variant="bottom" />
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: App shell + protected route group layout**

Create `components/shell/app-shell.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh">
      <Sidebar email={user?.email ?? ""} />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
```

Create `app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/shell/app-shell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 6: Placeholder pages for every destination**

Delete `app/page.tsx`. Create `app/(app)/page.tsx`:

```tsx
export default function OverviewPage() {
  return <h1 className="text-2xl font-semibold">Overview</h1>;
}
```

Create the same one-heading placeholder for each of `accounts`, `transactions`, `budgets`, `subscriptions`, `insights`, `settings` under `app/(app)/<name>/page.tsx`, each exporting a default component rendering `<h1 className="text-2xl font-semibold">Label</h1>` with the matching label.

- [ ] **Step 7: Verify shell responsiveness and nav**

Run: `npm run dev`, sign in. Expected: sidebar visible at desktop width with active highlighting; resize to mobile width → sidebar hides and bottom nav appears; each nav item routes to its placeholder. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add responsive app shell with sidebar and mobile bottom nav"
```

---

### Task 7: Quick-Add entry point (scaffold)

**Files:**
- Create: `components/quick-add/quick-add-provider.tsx`, `components/quick-add/quick-add-button.tsx`, `components/quick-add/quick-add-dialog.tsx`.
- Modify: `components/shell/app-shell.tsx` (mount the provider + floating button).

**Interfaces:**
- Consumes: `Dialog` from Task 2; `Button`; lucide `Plus`.
- Produces: a global `QuickAddProvider` exposing `useQuickAdd()` with `{ open, setOpen }`; a floating `+` button (mobile) and `⌘K`/`Ctrl+K` shortcut both opening a placeholder dialog. The dialog body is a placeholder ("Transaction forms arrive in Phase 4") — no data writes in Phase 1.

- [ ] **Step 1: Provider with keyboard shortcut**

Create `components/quick-add/quick-add-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type QuickAddContext = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = createContext<QuickAddContext | null>(null);

export function useQuickAdd() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Floating button + placeholder dialog**

Create `components/quick-add/quick-add-button.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  return (
    <Button
      onClick={() => setOpen(true)}
      size="icon"
      className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-6"
      aria-label="Quick add"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
```

Create `components/quick-add/quick-add-dialog.tsx`:

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddDialog() {
  const { open, setOpen } = useQuickAdd();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Transaction forms arrive in Phase 4.
        </p>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Mount in the shell**

Edit `components/shell/app-shell.tsx` to wrap its returned tree in `<QuickAddProvider>` and render `<QuickAddButton />` and `<QuickAddDialog />` inside it (alongside `children`/`BottomNav`).

- [ ] **Step 4: Verify**

Run: `npm run dev`, sign in. Expected: floating `+` opens the dialog; `⌘K` / `Ctrl+K` toggles it; Esc closes it. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add global Quick-Add entry point with keyboard shortcut"
```

---

## Self-Review

**Spec coverage (Phase 1 scope = spec §10.1 + §2 auth + §8 theming/mobile):**
- Next.js + TS + Tailwind + shadcn init → Tasks 1–2. ✅
- Supabase + `@supabase/ssr` auth + RLS-enforcing client → Tasks 4–5. ✅
- Theming light/dark/system, no-FOUC, semantic tokens → Task 3. ✅
- Mobile-first shell (bottom nav → sidebar) → Task 6. ✅
- Quick-Add scaffold → Task 7. ✅
- Per-user route protection → Task 4 middleware. ✅
- Out of Phase 1 by design: schema/tables/RLS policies/views (Phase 2), all money features (Phases 3–7). Not gaps.

**Placeholder scan:** Dialog body text "Transaction forms arrive in Phase 4" and the phase-6 page stubs are intentional scaffolds with explicit follow-ups, not plan placeholders; no "TBD/TODO/handle edge cases" left in steps.

**Type consistency:** `createClient()` name is used consistently for both browser and server modules (imported from distinct paths, matching `@supabase/ssr` convention). `NAV_ITEMS`/`NavItem`, `useQuickAdd`, and `NavLink` props (`variant: "side" | "bottom"`) are defined once and consumed with matching shapes. `updateSession` signature matches its middleware caller.

## Next phases (written just-in-time before each is executed)
- **Phase 2** — schema, RLS policies, derived views/functions, seed data.
- **Phase 3** — Accounts (bank/card/loan/asset), card groups, fee settings, account detail.
- **Phase 4** — Transactions + Quick-Add forms (currency/rate, tax/commission toggles, budget-only).
- **Phase 5** — Budgets. **Phase 6** — Subscriptions. **Phase 7** — Insights. **Phase 8** — Polish.
