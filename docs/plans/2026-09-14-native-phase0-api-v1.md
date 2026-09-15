# Native Phase 0 — bearer auth + `/api/v1` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the future Expo app call this Next.js app's server-lane features (statement import, Ask, today's take, FX rates)
with a Supabase access token instead of a cookie. The web app must behave exactly as before.

**Architecture:** `lib/supabase/server.ts#createClient()` becomes request-aware. When the request carries
`Authorization: Bearer <jwt>`, it returns a supabase-js client that sends that token (RLS still applies, and
`auth.getUser()` verifies it against Supabase Auth). Otherwise it returns the existing cookie client. Every
server action and `lib/**/queries.ts` already calls `createClient()`, so a thin `/api/v1/*` route handler can call an
existing server action unchanged. **This replaces the master plan's "extract services" step:** no service layer is needed.
The proxy lets bearer requests to `/api/*` through, and the route verifies the token itself.

**Tech Stack:** Next.js 16 App Router route handlers, `@supabase/supabase-js` 2.110, `@supabase/ssr` 0.12, next-intl 4, vitest 4.

**Spec:** `docs/plans/2026-09-14-expo-native-migration.md` (Phase 0).

## Global Constraints

- Web behavior must not change. Cookie sessions, CSP nonce and redirects stay as they are. All existing tests stay green.
- No database migrations in this phase. The agent cannot push to the live Supabase project.
- No service-role key anywhere. Bearer clients use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + the user's JWT.
- The locale for bearer requests comes from `Accept-Language`, which `i18n/request.ts` already does. Don't add a locale mechanism.
- Response bodies on success are the server action's own return value, as JSON. Auth failures return HTTP 401 with `{"error":"unauthorized"}`.
- Verified already: a `SupabaseClient<Database>` from `createClient<Database>()` in supabase-js is assignable to
  `ReturnType<typeof createServerClient<Database>>` (tsc clean). With a custom `Authorization` global header,
  `auth.getUser()` with no argument sends that header to `/auth/v1/user` (`hasCustomAuthorizationHeader` in auth-js).
- Work on branch `feat/native-api-v1` in this checkout (no worktree). When done, merge into `main`, delete the branch, push.
- Commit trailer (every commit):
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs
  ```
- The RTK hook mangles git output. Verify git state with `git --no-pager ...` or `rtk proxy git ...`.

---

### Task 1: Bearer-aware server Supabase client

**Files:**
- Create: `lib/supabase/bearer.ts`
- Create: `lib/supabase/bearer.test.ts`
- Modify: `lib/supabase/server.ts` (whole file, 27 lines)
- Create: `lib/supabase/server.test.ts`

**Interfaces:**
- Produces: `bearerToken(authorization: string | null | undefined): string | null` (pure, from `@/lib/supabase/bearer`)
- Produces: `createClient(): Promise<SupabaseClient>` from `@/lib/supabase/server`. The signature is unchanged; it now honors bearer headers.

- [ ] **Step 1: Create the branch**

```bash
cd /home/cm-corp/projects/tywin && git switch -c feat/native-api-v1
```

- [ ] **Step 2: Write the failing test for `bearerToken`**

`lib/supabase/bearer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bearerToken } from "./bearer";

describe("bearerToken", () => {
  it("returns the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("is case-insensitive about the scheme", () => {
    expect(bearerToken("bearer abc")).toBe("abc");
  });

  it("returns null when there is no header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
  });

  /* A Basic header, a bare token or an empty Bearer is not a token. Treating any of
     them as one would switch the request off its cookie session for nothing. */
  it("rejects anything that is not exactly one Bearer token", () => {
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("abc.def.ghi")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/supabase/bearer.test.ts`
Expected: FAIL, `Failed to resolve import "./bearer"`.

- [ ] **Step 4: Implement `bearerToken`**

`lib/supabase/bearer.ts`:

```ts
/**
 * The access token from an `Authorization: Bearer <jwt>` header, or null.
 *
 * The native app has no cookie jar, so it sends the Supabase access token this way.
 * This only extracts it and does not check it. Verification is `auth.getUser()` on the
 * client built from it, the same call every server action already makes.
 */
export function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run lib/supabase/bearer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test for `createClient`**

`lib/supabase/server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (k: string) => headerStore.get(k.toLowerCase()) ?? null })),
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ kind: "cookie" })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ kind: "token" })) }));

import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { createClient } from "./server";

beforeEach(() => {
  headerStore.clear();
  vi.mocked(createServerClient).mockClear();
  vi.mocked(createTokenClient).mockClear();
});

describe("createClient", () => {
  it("uses the cookie session when there is no bearer token", async () => {
    const client = await createClient();
    expect(client).toEqual({ kind: "cookie" });
    expect(createTokenClient).not.toHaveBeenCalled();
  });

  it("uses the bearer token when one is sent, and never persists or refreshes it", async () => {
    headerStore.set("authorization", "Bearer jwt-123");
    const client = await createClient();
    expect(client).toEqual({ kind: "token" });
    expect(createServerClient).not.toHaveBeenCalled();
    const options = vi.mocked(createTokenClient).mock.calls[0][2];
    expect(options?.global?.headers).toEqual({ Authorization: "Bearer jwt-123" });
    expect(options?.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  it("falls back to cookies for a malformed Authorization header", async () => {
    headerStore.set("authorization", "Basic dXNlcjpwYXNz");
    await expect(createClient()).resolves.toEqual({ kind: "cookie" });
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run lib/supabase/server.test.ts`
Expected: FAIL. The bearer test gets `{ kind: "cookie" }`.

- [ ] **Step 8: Implement the bearer branch**

Replace `lib/supabase/server.ts` with:

```ts
import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { bearerToken } from "./bearer";
import type { Database } from "./types";

/**
 * The Supabase client for this request, authenticated as whoever made it.
 *
 * Two kinds of caller reach the same server code. The web app carries a cookie
 * session. The native app has no cookie jar and sends its access token as
 * `Authorization: Bearer`. Deciding here, once, means every server action and every
 * `lib/**\/queries.ts` serves both unchanged, and a `/api/v1` route is just a thin
 * wrapper around an existing action.
 *
 * The bearer client is still the user's own client. It sends the publishable key
 * plus the user's JWT, so RLS scopes every query exactly as it does for a
 * cookie session, and `auth.getUser()` checks the token with Supabase Auth
 * (supabase-js forwards a custom Authorization header on that call). It never
 * stores or refreshes the token: refreshing is the phone's job.
 */
export async function createClient() {
  const token = bearerToken((await headers()).get("authorization"));
  if (token) {
    return createTokenClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    );
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(
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

- [ ] **Step 9: Run the tests and the typecheck**

Run: `npx vitest run lib/supabase/ && npx tsc --noEmit -p .`
Expected: vitest PASS (7 tests). tsc prints nothing new. A stale `.next/types/validator.ts` error about
`app/(app)/subscriptions/page.js` was already there; clear it with `rm -rf .next/types` if it shows up. If tsc
reports that the two return types differ at call sites that use `Awaited<ReturnType<typeof createClient>>`, annotate
the function `Promise<ReturnType<typeof createServerClient<Database>>>`. It was verified assignable.

- [ ] **Step 10: Commit**

```bash
git add lib/supabase/bearer.ts lib/supabase/bearer.test.ts lib/supabase/server.ts lib/supabase/server.test.ts
git commit -m "feat(api): server Supabase client accepts a bearer token

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
```

---

### Task 2: Proxy lets bearer API requests through

**Files:**
- Modify: `lib/supabase/middleware.ts` (`updateSession`, before `createServerClient` at line ~73)
- Create: `lib/supabase/middleware.test.ts`

**Interfaces:**
- Consumes: `bearerToken` from Task 1.
- Produces: no new exports. Behavior: `/api/*` + a valid-shaped Bearer header → `NextResponse.next` with CSP, and no cookie auth call.

- [ ] **Step 1: Write the failing test**

`lib/supabase/middleware.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn(async () => ({ data: { user: null } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

import { createServerClient } from "@supabase/ssr";
import { updateSession } from "./middleware";

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });

beforeEach(() => {
  getUser.mockClear();
  vi.mocked(createServerClient).mockClear();
});

describe("updateSession", () => {
  it("still 401s a signed-out API call with no token", async () => {
    const res = await updateSession(req("/api/v1/recommendation"));
    expect(res.status).toBe(401);
  });

  /* The route verifies the token itself (lib/supabase/server.ts). The cookie check here
     can only see "no cookie" and would 401 a perfectly valid native request. */
  it("passes a bearer API call through to the route without a cookie lookup", async () => {
    const res = await updateSession(req("/api/v1/recommendation", { authorization: "Bearer jwt" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("does not let a bearer header open a page route", async () => {
    const res = await updateSession(req("/transactions", { authorization: "Bearer jwt" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/supabase/middleware.test.ts`
Expected: FAIL on "passes a bearer API call through" (status 401, and `createServerClient` was called).

- [ ] **Step 3: Implement the pass-through**

In `lib/supabase/middleware.ts`, add the import at the top:

```ts
import { bearerToken } from "./bearer";
```

Then, in `updateSession`, directly after `let response = withHeaders();` and before `const supabase = createServerClient(`, add:

```ts
  /* The native app authenticates with `Authorization: Bearer`, not a cookie. The
     route handler checks that token itself (lib/supabase/server.ts), so a cookie
     lookup here could only find nothing and 401 a valid request. API paths only:
     a page route still needs a cookie session, whatever headers it carries. */
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    bearerToken(request.headers.get("authorization"))
  ) {
    return response;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/supabase/ proxy.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/middleware.ts lib/supabase/middleware.test.ts
git commit -m "feat(api): proxy passes bearer-authenticated API calls to the route

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
```

---

### Task 3: Shared per-user rate limiter, applied to statement parsing

A native client can POST PDFs in a loop, and every parse is a Gemini call. `/ask` already has an in-memory
limiter. This task extracts it into a generic one and applies it to `parseStatement`, which covers web and
native alike.

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `lib/rate-limit.test.ts`
- Modify: `lib/ask/rate-limit.ts` (keep its big header comment, the exports `ASK_MAX_PER_WINDOW`, `ASK_WINDOW_MS`, `takeAskToken`, `resetAskRateLimit`; replace the body)
- Create: `lib/statements/rate-limit.ts`
- Modify: `app/(app)/accounts/statement-actions.ts` (`extractAndParse`, right after the `if (!user)` line)
- Modify: `app/(app)/accounts/statement-actions.test.ts` (add reset in `beforeEach`, add one test)

**Interfaces:**
- Produces: `createRateLimiter(opts: { max: number; windowMs: number }): { take(key: string, now: number): boolean; reset(): void }`
- Produces: `takeStatementParseToken(userId: string, now: number): boolean`, `resetStatementParseRateLimit(): void`, `STATEMENT_PARSE_MAX_PER_WINDOW = 10`, `STATEMENT_PARSE_WINDOW_MS = 10 * 60_000` from `@/lib/statements/rate-limit`

- [ ] **Step 1: Write the failing test for the generic limiter**

`lib/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const T0 = 1_800_000_000_000;

describe("createRateLimiter", () => {
  it("allows up to max inside the window, then refuses", () => {
    const l = createRateLimiter({ max: 3, windowMs: 1000 });
    expect([l.take("u", T0), l.take("u", T0 + 1), l.take("u", T0 + 2)]).toEqual([true, true, true]);
    expect(l.take("u", T0 + 3)).toBe(false);
  });

  it("forgets hits older than the window", () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    l.take("u", T0);
    expect(l.take("u", T0 + 1001)).toBe(true);
  });

  it("counts keys separately and resets", () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    l.take("a", T0);
    expect(l.take("b", T0)).toBe(true);
    l.reset();
    expect(l.take("a", T0)).toBe(true);
  });

  /* Two limiters must not share state: the Ask cap and the statement cap are different budgets. */
  it("keeps separate limiters independent", () => {
    const a = createRateLimiter({ max: 1, windowMs: 1000 });
    const b = createRateLimiter({ max: 1, windowMs: 1000 });
    a.take("u", T0);
    expect(b.take("u", T0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: FAIL, `Failed to resolve import "./rate-limit"`.

- [ ] **Step 3: Implement `createRateLimiter`**

`lib/rate-limit.ts`:

```ts
/**
 * A per-process sliding-window counter, one per budget.
 *
 * Best-effort by design. See lib/ask/rate-limit.ts for why this lives in memory
 * and not in a table. Under Fluid Compute one instance serves many requests, so it
 * catches one person hammering one endpoint and undercounts across a fleet.
 * `now` is a parameter so windows can be tested without waiting.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  /** key -> timestamps of accepted requests inside the window. */
  const hits = new Map<string, number[]>();

  return {
    take(key: string, now: number): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }

      recent.push(now);
      hits.set(key, recent);

      /* Nothing else prunes this map, and an instance can outlive many sessions. */
      if (hits.size > 5_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => t <= cutoff)) hits.delete(k);
        }
      }

      return true;
    },
    reset(): void {
      hits.clear();
    },
  };
}
```

- [ ] **Step 4: Rewire the Ask limiter onto it**

In `lib/ask/rate-limit.ts`, keep the header comment and the two constants. Replace everything from
`/** userId -> timestamps of accepted requests inside the window. */` to the end of the file with:

```ts
const limiter = createRateLimiter({ max: ASK_MAX_PER_WINDOW, windowMs: ASK_WINDOW_MS });

/**
 * Records one request and reports whether it is allowed.
 *
 * `now` is a parameter rather than a `Date.now()` call so the window can be
 * tested without waiting five minutes for it.
 */
export function takeAskToken(userId: string, now: number): boolean {
  return limiter.take(userId, now);
}

/** Test seam: forget every recorded request. */
export function resetAskRateLimit(): void {
  limiter.reset();
}
```

and add `import { createRateLimiter } from "@/lib/rate-limit";` at the top (after the header comment is fine,
but imports must be the first statements in the module, so put the import above the comment block).

- [ ] **Step 5: Run the limiter tests**

Run: `npx vitest run lib/rate-limit.test.ts lib/ask/rate-limit.test.ts`
Expected: PASS (4 + 5 tests). The unchanged Ask tests prove the refactor kept behavior.

- [ ] **Step 6: Add the statement limiter**

`lib/statements/rate-limit.ts`:

```ts
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * How many statements one person may send to extraction per window.
 *
 * Every parse is a PDF render plus a Gemini call, and until the native app existed
 * the only way to trigger one was the upload dialog, which paced itself. A phone
 * can POST in a loop. Ten in ten minutes is well above an honest session (a
 * person with five cards importing each, with a retry or two) and far below a
 * quota-burning one.
 */
export const STATEMENT_PARSE_MAX_PER_WINDOW = 10;
export const STATEMENT_PARSE_WINDOW_MS = 10 * 60_000;

const limiter = createRateLimiter({
  max: STATEMENT_PARSE_MAX_PER_WINDOW,
  windowMs: STATEMENT_PARSE_WINDOW_MS,
});

export function takeStatementParseToken(userId: string, now: number): boolean {
  return limiter.take(userId, now);
}

/** Test seam. */
export function resetStatementParseRateLimit(): void {
  limiter.reset();
}
```

- [ ] **Step 7: Write the failing action test**

In `app/(app)/accounts/statement-actions.test.ts`:

1. Add to the imports (after the `@/lib/statements/limits` import):

```ts
import {
  resetStatementParseRateLimit,
  STATEMENT_PARSE_MAX_PER_WINDOW,
  takeStatementParseToken,
} from "@/lib/statements/rate-limit";
```

2. In `describe("parseStatement")`, change its `beforeEach` (line ~238) to:

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    resetStatementParseRateLimit();
    (createClient as unknown as Mock).mockResolvedValue(makeSupabaseStub());
  });
```

3. Add this test at the end of that same `describe` block, after "lets a file at the limit through to extraction".
`makeSupabaseStub()` signs in as `"user-1"`, and `getTranslations` is mocked to return the key itself:

```ts
  it("refuses extraction once the person's parse budget is spent, before reading the PDF", async () => {
    for (let i = 0; i < STATEMENT_PARSE_MAX_PER_WINDOW; i++) {
      takeStatementParseToken("user-1", Date.now());
    }
    const result = await parseStatement(buildUploadFormData(1024));
    expect(result.error).toBe("llmRateLimited");
    expect(extractStatementText).not.toHaveBeenCalled();
  });
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`
Expected: the new test FAILs (extraction runs). The other tests still PASS.

- [ ] **Step 9: Apply the limiter in `extractAndParse`**

In `app/(app)/accounts/statement-actions.ts`, add the import:

```ts
import { takeStatementParseToken } from "@/lib/statements/rate-limit";
```

and in `extractAndParse`, directly after
`if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;`, add:

```ts
  // Before the file is even read: a refused request should cost nothing and
  // leave no failed-import row. The copy already says "try again in a minute".
  if (!takeStatementParseToken(user.id, Date.now())) {
    return { error: t("llmRateLimited") } as const;
  }
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run "app/(app)/accounts/" lib/rate-limit.test.ts lib/ask/ lib/statements/`
Expected: PASS (all).

- [ ] **Step 11: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts lib/ask/rate-limit.ts lib/statements/rate-limit.ts "app/(app)/accounts/statement-actions.ts" "app/(app)/accounts/statement-actions.test.ts"
git commit -m "feat(statements): cap statement extractions per person

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
```

---

### Task 4: `/api/v1` route handlers

**Files:**
- Create: `lib/api/respond.ts`
- Create: `lib/api/respond.test.ts`
- Create: `app/api/v1/statements/parse/route.ts`
- Create: `app/api/v1/statements/confirm/route.ts`
- Create: `app/api/v1/recommendation/route.ts`
- Create: `app/api/v1/fx/route.ts`
- Create: `app/api/v1/ask/route.ts`
- Create: `app/api/v1/routes.test.ts`

**Interfaces:**
- Consumes: `createClient` (Task 1), `parseStatement(formData: FormData): Promise<StatementPreviewResult>`,
  `confirmStatementImport(formData: FormData): Promise<{ error?: string; importId?: string; uncategorized?: number }>`
  (both in `@/app/(app)/accounts/statement-actions`), `refreshRecommendation(): Promise<{ refreshed: boolean }>`
  (`@/app/(app)/actions`), `getExchangeRates(base: string): Promise<Record<string, number>>` (`@/lib/fx`),
  `baseCurrencyOf(profile)` (`@/lib/profile`), `GET`/`POST` from `@/app/api/ask/route`.
- Produces: `apiUser(): Promise<User | null>`, `unauthorized(): Response`, `badRequest(code: string): Response` from `@/lib/api/respond`.
- Produces HTTP contract:
  - `POST /api/v1/statements/parse`: multipart `file`, `account_id`, optional `password` → `StatementPreviewResult` JSON
  - `POST /api/v1/statements/confirm`: multipart `account_id`, `file_name`, `parsed_statement`, `mappings` (JSON string), optional `exclude_from_budget` → `{ error?, importId?, uncategorized? }`
  - `POST /api/v1/recommendation` → `{ refreshed: boolean }` (the phone then reads `daily_recommendations` directly)
  - `GET /api/v1/fx` → `{ base: string, rates: Record<string, number> }` for the caller's profile base currency
  - `POST /api/v1/ask`, `GET /api/v1/ask`: identical to `/api/ask` (UI message stream / warm-up 204)

- [ ] **Step 1: Write the failing test for the helpers**

`lib/api/respond.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

import { apiUser, badRequest, unauthorized } from "./respond";

beforeEach(() => getUser.mockReset());

describe("api helpers", () => {
  it("apiUser returns the verified user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(apiUser()).resolves.toEqual({ id: "u1" });
  });

  it("apiUser returns null when the token or session is not valid", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid JWT") });
    await expect(apiUser()).resolves.toBeNull();
  });

  it("unauthorized and badRequest carry machine-readable codes", async () => {
    const u = unauthorized();
    expect(u.status).toBe(401);
    await expect(u.json()).resolves.toEqual({ error: "unauthorized" });
    const b = badRequest("invalid_form");
    expect(b.status).toBe(400);
    await expect(b.json()).resolves.toEqual({ error: "invalid_form" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/api/respond.test.ts`
Expected: FAIL, `Failed to resolve import "./respond"`.

- [ ] **Step 3: Implement the helpers**

`lib/api/respond.ts`:

```ts
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in caller of a `/api/v1` route, whether the route was reached with a cookie (web)
 * or a bearer token (native). Null means "answer 401".
 *
 * Checked up front even though every action behind these routes checks again. An action
 * signals "not signed in" as translated prose inside a 200, and a phone needs a status
 * code it can act on (refresh the token, or send the person to sign-in).
 */
export async function apiUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** `code` is for the client to switch on, not prose. The app owns the wording. */
export function badRequest(code: string): Response {
  return Response.json({ error: code }, { status: 400 });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/api/respond.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing route tests**

`app/api/v1/routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ maybeSingle }) }),
  })),
}));
vi.mock("@/app/(app)/accounts/statement-actions", () => ({
  parseStatement: vi.fn(async () => ({ preview: { parserId: "p" } })),
  confirmStatementImport: vi.fn(async () => ({ importId: "imp-1", uncategorized: 2 })),
}));
vi.mock("@/app/(app)/actions", () => ({
  refreshRecommendation: vi.fn(async () => ({ refreshed: true })),
}));
vi.mock("@/lib/fx", () => ({ getExchangeRates: vi.fn(async () => ({ DOP: 1, USD: 0.016 })) }));
vi.mock("@/app/api/ask/route", () => ({
  GET: vi.fn(async () => new Response(null, { status: 204 })),
  POST: vi.fn(async () => new Response("stream")),
}));

import { parseStatement, confirmStatementImport } from "@/app/(app)/accounts/statement-actions";
import { getExchangeRates } from "@/lib/fx";
import { POST as parse } from "./statements/parse/route";
import { POST as confirm } from "./statements/confirm/route";
import { POST as recommendation } from "./recommendation/route";
import { GET as fx } from "./fx/route";
import { GET as askGet, POST as askPost } from "./ask/route";

const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });

const multipart = (fields: Record<string, string | Blob>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/api/v1/x", { method: "POST", body: fd });
};

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { base_currency: "DOP" } });
});

describe("/api/v1", () => {
  it.each([
    ["parse", () => parse(multipart({ account_id: "a" }))],
    ["confirm", () => confirm(multipart({ account_id: "a" }))],
    ["recommendation", () => recommendation()],
    ["fx", () => fx()],
  ])("%s answers 401 when signed out", async (_name, call) => {
    signedOut();
    const res = await call();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("parse hands the multipart form to parseStatement and returns its result", async () => {
    signedIn();
    const res = await parse(multipart({ account_id: "acc-1", file: new Blob(["%PDF"], { type: "application/pdf" }) }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ preview: { parserId: "p" } });
    const form = vi.mocked(parseStatement).mock.calls[0][0];
    expect(form.get("account_id")).toBe("acc-1");
  });

  it("parse answers 400 when the body is not a form", async () => {
    signedIn();
    const res = await parse(new Request("http://localhost/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_form" });
    expect(parseStatement).not.toHaveBeenCalled();
  });

  it("confirm hands the form to confirmStatementImport", async () => {
    signedIn();
    const res = await confirm(multipart({ account_id: "acc-1", file_name: "s.pdf", parsed_statement: "{}", mappings: "{}" }));
    await expect(res.json()).resolves.toEqual({ importId: "imp-1", uncategorized: 2 });
    expect(vi.mocked(confirmStatementImport).mock.calls[0][0].get("file_name")).toBe("s.pdf");
  });

  it("recommendation returns whether it regenerated", async () => {
    signedIn();
    await expect((await recommendation()).json()).resolves.toEqual({ refreshed: true });
  });

  it("fx returns rates for the caller's base currency", async () => {
    signedIn();
    maybeSingle.mockResolvedValue({ data: { base_currency: "USD" } });
    const res = await fx();
    await expect(res.json()).resolves.toEqual({ base: "USD", rates: { DOP: 1, USD: 0.016 } });
    expect(getExchangeRates).toHaveBeenCalledWith("USD");
  });

  it("ask is the same handler as /api/ask", async () => {
    expect((await askGet()).status).toBe(204);
    expect(await (await askPost(new Request("http://localhost/x", { method: "POST" }))).text()).toBe("stream");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run app/api/v1/routes.test.ts`
Expected: FAIL, `Failed to resolve import "./statements/parse/route"`.

- [ ] **Step 7: Implement the routes**

`app/api/v1/statements/parse/route.ts`:

```ts
import { parseStatement } from "@/app/(app)/accounts/statement-actions";
import { apiUser, badRequest, unauthorized } from "@/lib/api/respond";

/* PDF render plus one Gemini call, with the same cold-start exposure /api/ask documents. */
export const maxDuration = 120;

/**
 * The upload dialog's parse step, for the native app. Same action, same limits
 * (size cap, per-user parse budget), same preview shape. The phone echoes
 * `parsedStatement` back to /confirm exactly as the dialog does.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("invalid_form");
  }
  return Response.json(await parseStatement(form));
}
```

`app/api/v1/statements/confirm/route.ts`:

```ts
import { confirmStatementImport } from "@/app/(app)/accounts/statement-actions";
import { apiUser, badRequest, unauthorized } from "@/lib/api/respond";

/** The dialog's Import step. No LLM here: it validates the echoed statement and runs the import RPC. */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("invalid_form");
  }
  return Response.json(await confirmStatementImport(form));
}
```

`app/api/v1/recommendation/route.ts`:

```ts
import { refreshRecommendation } from "@/app/(app)/actions";
import { apiUser, unauthorized } from "@/lib/api/respond";

export const maxDuration = 60;

/**
 * Regenerates today's take if it is stale. The phone fires this on Overview mount
 * without awaiting it, as the web card does, and reads the row from
 * `daily_recommendations` directly.
 */
export async function POST() {
  if (!(await apiUser())) return unauthorized();
  return Response.json(await refreshRecommendation());
}
```

`app/api/v1/fx/route.ts`:

```ts
import { apiUser, unauthorized } from "@/lib/api/respond";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/fx";
import { baseCurrencyOf } from "@/lib/profile";

/**
 * Live rates into the caller's base currency, for the balances the phone converts itself
 * (net worth, card totals). Served from here and not fetched from the FX provider by the
 * phone, so every client shares lib/fx.ts's 12-hour cache and its "never cache an empty
 * table" rule.
 *
 * Authenticated even though rates are public, so this cannot become a free open proxy.
 */
export async function GET() {
  if (!(await apiUser())) return unauthorized();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("base_currency").maybeSingle();
  const base = baseCurrencyOf(profile);
  return Response.json({ base, rates: await getExchangeRates(base) });
}
```

`app/api/v1/ask/route.ts`:

```ts
/* The versioned path for the native app. It is the same handler, not a copy: /api/ask already
   authenticates through createClient(), which accepts a bearer token. Route segment config
   must be a literal in each route file, so maxDuration is restated rather than re-exported. */
export { GET, POST } from "@/app/api/ask/route";
export const maxDuration = 120;
```

Check `baseCurrencyOf`'s parameter type in `lib/profile.ts` before relying on it. It's already called as
`baseCurrencyOf(profile)` with the same `maybeSingle()` result in `statement-actions.ts`, so the shape matches.

- [ ] **Step 8: Run the tests and the typecheck**

Run: `npx vitest run app/api/v1 lib/api && npx tsc --noEmit -p .`
Expected: PASS (all), tsc clean.

- [ ] **Step 9: Commit**

```bash
git add lib/api "app/api/v1"
git commit -m "feat(api): /api/v1 routes for statement import, today's take, FX and Ask

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
```

---

### Task 5: Native API contract and lane map

**Files:**
- Create: `docs/native-api.md`
- Modify: `docs/plans/2026-09-14-expo-native-migration.md` (Phase 0 section)

**Interfaces:**
- Consumes: the HTTP contract from Task 4 and the server-action list below.
- Produces: the document the Expo repo's data layer is built from.

- [ ] **Step 1: Classify every server action**

For each action in the list, decide the lane with these checks:

```bash
cd /home/cm-corp/projects/tywin
# LLM or other secret/remote work reached from an action
rtk proxy grep -rn "inferCardArt\|resolveBrand\|inferRecommendation\|extractWithLLM\|getExchangeRates\|google(" "app/(app)" app/welcome lib --include=*.ts | grep -v test
# TS-only invariants: validation or derived values computed before a write
rtk proxy grep -n "safeParse\|schema\.\|exchange_rate\|base_amount" "app/(app)"/*/actions.ts "app/(app)"/*/*-actions.ts app/welcome/actions.ts
```

Rules:
- **server**: calls an LLM, `getExchangeRates`, or computes stored values the DB doesn't derive (e.g. `base_amount` from a rate), or re-derives targets for security (e.g. `categorizeTriageGroup`).
- **direct**: a single insert/update/delete/RPC whose validity RLS plus table constraints already guarantee. Zod checks that only mirror column constraints don't count.
- **auth**: replaced by supabase-js auth on the device.

Actions (54): `refreshRecommendation`; accounts: `createAccount`, `updateAccount`, `backfillCardArt`, `archiveAccount`, `deleteAccount`, `createBank`, `createCardWithLines`, `createCardStub`, `addCardLine`; budgets: `setBudget`, `createCategory`, `updateCategory`, `deleteCategory`, `copyPreviousMonth`; imports: `categorizeTriageGroup`; recurring: `createSubscription`, `updateSubscription`, `resolveSubscriptionBrand`, `deleteSubscription`, `setSubscriptionActive`, `addCharge`; settings: `updateBaseCurrency`, `deleteAccount` (the `delete_own_account` RPC), `updateDisplayName`, `setPayCycle`; transactions: `loadTransactions`, `createTransaction`, `updateTransaction`, `deleteTransaction`; statements: `listImportTargets`, `listStubCurrencies`, `parseStatement`, `confirmStatementImport`, `deleteCardStatement`, `saveMerchantRule`, `getStatementLineDetail`; goals: `createGoal`, `updateGoal`, `deleteGoal`, `deleteContribution`, `addContribution`; groups: `createBudgetGroup`, `updateBudgetGroup`, `deleteBudgetGroup`, `setGroupBudget`, `setCategoryGroup`; rules: `updateRule`, `deleteRule`; `finishOnboarding`; `setLocale`; login: `signIn`, `signUp`, `signInWithGoogle`.

- [ ] **Step 2: Write `docs/native-api.md`**

Structure (fill the lane table from Step 1; every one of the 54 actions gets a row):

```markdown
# Native API contract (v1)

## Authentication
- Sign in on the device with supabase-js (`signInWithPassword`, `signInWithIdToken` for Google/Apple).
- Every `/api/v1` call sends `Authorization: Bearer <session.access_token>` and `Accept-Language: es` or `en`
  (the locale for server-written copy, like errors and today's take).
- A 401 `{"error":"unauthorized"}` means: refresh the session once and retry; if it still fails, sign out.
- Everything not listed under Server lane goes straight to Supabase with the same session (RLS applies).

## Endpoints
| Method + path | Body | Success | Errors |
| --- | --- | --- | --- |
| POST /api/v1/statements/parse | multipart: file (PDF ≤ 10 MB), account_id, password? | StatementPreviewResult (see app/(app)/accounts/statement-actions.ts) | 401, 400 invalid_form; `error` / `needsPassword` in body |
| POST /api/v1/statements/confirm | multipart: account_id, file_name, parsed_statement (echo from parse), mappings (JSON object sectionKey→accountId), exclude_from_budget? ("false" to include) | { importId, uncategorized } | 401, 400 invalid_form; `error` in body |
| POST /api/v1/recommendation | — | { refreshed } — then read daily_recommendations | 401 |
| GET /api/v1/fx | — | { base, rates } | 401 |
| POST /api/v1/ask | { messages: UIMessage[] } (AI SDK v7 UI message stream) | stream | 401, 400, 413, 429 |
| GET /api/v1/ask | — | 204 (warm-up) | 401, 429 |

In-body `error` strings are translated prose meant for display. Status codes are for control flow.

## Server-action lane map
| Action | Lane | Why | Native path |
| --- | --- | --- | --- |
| ...one row per action from Step 1... |

## Compatibility rules
- Installed apps can't be force-updated: never change a v1 response shape in a breaking way. Add fields, or add /api/v2.
- DB changes the phone reads directly must be additive for one release cycle (see the master plan's risks).
```

For every action classified **server** that has no endpoint yet (expected: at least the card-art/brand-inference
account and subscription creates, `categorizeTriageGroup`, `createTransaction`/`updateTransaction` if they compute
`base_amount`), write "endpoint added when its screen is nativized (Phase 3)" in the Native path column. Don't
build those endpoints now.

- [ ] **Step 3: Update the master plan's Phase 0**

In `docs/plans/2026-09-14-expo-native-migration.md`, replace the Phase 0 list items 1–3 with:

```markdown
1. **Bearer-aware `createClient()`** (`lib/supabase/server.ts`): one decision point, so every server action
   and query serves a bearer token unchanged. The proxy passes bearer `/api/*` calls through to the route.
   No service extraction is needed. Done in `docs/plans/2026-09-14-native-phase0-api-v1.md`.
2. **`/api/v1`**: statements parse/confirm, recommendation, fx, ask. Contract and the lane map for all 54
   server actions are in `docs/native-api.md`. Endpoints for the other server-lane actions land with their screen in Phase 3.
3. **Server-lane invariants**: the lane map records which actions compute or re-derive values in TS. Those
   stay server-lane (or move into Postgres later via a migration the user pushes).
```

Keep item 4 (rate limits) and append "Done for statement parsing and Ask." Move items 5 (Supabase Auth config) and
6 (account deletion) out of Phase 0 to become the first two items of Phase 2, because they depend on the app ID and
the native Settings screen.

- [ ] **Step 4: Commit**

```bash
git add docs/native-api.md docs/plans/2026-09-14-expo-native-migration.md docs/plans/2026-09-14-native-phase0-api-v1.md
git commit -m "docs(native): v1 API contract, server-action lane map and migration plans

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
```

---

### Task 6: Full verification and merge

**Files:** none new.

- [ ] **Step 1: Full test suite, typecheck, lint**

Run: `npm test && npx tsc --noEmit -p . && npm run lint`
Expected: all vitest files PASS and tsc is clean. eslint may report errors that were already there. Run
`git --no-pager diff main --name-only` and confirm none of the reported files are in that list.

- [ ] **Step 2: Production build**

Run: `NODE_OPTIONS=--max-old-space-size=6144 npm run build`
Expected: build succeeds, and the route list includes `/api/v1/statements/parse`, `/api/v1/statements/confirm`,
`/api/v1/recommendation`, `/api/v1/fx`, `/api/v1/ask`.

- [ ] **Step 3: Live smoke test (needs the user)**

**Ask the user before starting the dev server**, and ask them for a test account's access token. They can
copy it from the browser devtools: Application → Cookies → the `sb-…-auth-token` value, base64-decoded,
field `access_token`. Then, with the server on port 3000:

```bash
TOKEN=...   # from the user; never commit or echo it into files
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/fx                                  # expect 401
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/fx | head -c 200                   # expect {"base":"DOP","rates":{...
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/recommendation              # expect {"refreshed":true|false}
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:3000/transactions  # expect 307 (pages still need a cookie)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer not-a-jwt" http://localhost:3000/api/v1/fx  # expect 401
```

Then sign in to the web app in agent-browser and open `/`, `/accounts`, `/ask` to confirm the cookie path still works.
Stop the dev server and close the agent-browser session afterwards.

- [ ] **Step 4: Merge, clean up, push**

```bash
git switch main
git merge --no-ff feat/native-api-v1 -m "Merge branch 'feat/native-api-v1'

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012LEdP9cNrumo1R2nZk1efs"
git branch -d feat/native-api-v1
rtk proxy git push origin main
git --no-pager log --oneline -8 && git --no-pager status -sb | head -1
```

Expected: `main...origin/main` with no ahead/behind.
