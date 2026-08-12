# Daily Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a card to the overview page showing a short, Gemini-generated piece of coaching about the user's own finances, regenerated at most once every 12 hours.

**Architecture:** A `daily_recommendations` table holds one upserted row per user. The overview server component reads that row and hands it to a client card along with a `stale` flag; when stale, the card fires a server action that builds a redacted numeric snapshot, calls Gemini, upserts the row and refreshes the router. Nothing blocks page render — the previous recommendation shows immediately and the new one swaps in when it lands.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Supabase (Postgres + RLS), AI SDK `generateObject` with `@ai-sdk/google` (Gemini), Zod 4, next-intl, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-daily-recommendation-design.md`

## Global Constraints

- Inference never throws. Every failure path returns null/`false` and writes nothing. Follow `lib/subscriptions/llm/brand.ts`.
- Inference uses `DEFERRED_INFERENCE_BUDGET_MS` (90s) via `inferenceSignal()` from `@/lib/llm/budget`. Never `BLOCKING_INFERENCE_BUDGET_MS`.
- The model is `google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite")` — copy this expression verbatim from `lib/subscriptions/llm/brand.ts:111`.
- Never send to the model: display name, email, user id, account names, institutions, card last 4, goal names, subscription names, transaction descriptions or merchants, or any UUID. Category names ARE sent.
- All user-facing chrome strings go through next-intl in BOTH `messages/en.json` and `messages/es.json`. The generated recommendation text itself is never translated — it is generated in the user's locale.
- Vitest runs in the **node** environment (`vitest.config.ts` sets only `globals: true`; there is no jsdom). No test may render a React component. Anything that needs testing must be a pure function in a `.ts` file.
- Tests live beside their source as `<name>.test.ts`, matching the repo.
- Run `npm test` and `npm run lint` before each commit.

---

### Task 1: Migration and generated types

**Files:**
- Create: `supabase/migrations/20260811120000_daily_recommendations.sql`
- Modify: `lib/supabase/types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: the `daily_recommendations` table with columns `user_id uuid`, `headline text`, `body text`, `tone text`, `locale text`, `generated_at timestamptz`; typed into `lib/supabase/types.ts` so `supabase.from("daily_recommendations")` compiles.

- [ ] **Step 1: Write the migration**

```sql
-- One live recommendation per user: a short piece of coaching generated from
-- their own numbers, refreshed at most twice a day.
--
-- `user_id` is the PRIMARY KEY rather than a surrogate id with a unique index,
-- because a second row for the same user has no meaning. Nothing reads the
-- previous recommendation once a new one lands, so there is no history here and
-- no `created_at` distinct from `generated_at`.

create table public.daily_recommendations (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  headline     text not null,
  body         text not null,
  tone         text not null check (tone in ('good', 'watch', 'neutral')),
  -- The locale the text was WRITTEN in. Read side treats a mismatch against the
  -- current locale as staleness, so switching language does not leave someone
  -- reading the other language for the rest of the 12h window.
  locale       text not null,
  generated_at timestamptz not null default now()
);

alter table public.daily_recommendations enable row level security;
create policy "daily_recommendations: owner read" on public.daily_recommendations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner insert" on public.daily_recommendations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner update" on public.daily_recommendations
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner delete" on public.daily_recommendations
  for delete to authenticated using ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Push the migration and regenerate types**

Run: `npm run db:push && npm run db:types`
Expected: the push applies cleanly; `git diff lib/supabase/types.ts` shows a new `daily_recommendations` entry under `Tables`.

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811120000_daily_recommendations.sql lib/supabase/types.ts
git commit -m "feat(overview): add daily_recommendations table"
```

---

### Task 2: Freshness rule

**Files:**
- Create: `lib/overview/recommendation/freshness.ts`
- Test: `lib/overview/recommendation/freshness.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RECOMMENDATION_TTL_MS: number` and `isStale(generatedAt: string, rowLocale: string, locale: string, now?: Date): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/overview/recommendation/freshness.test.ts
import { describe, expect, it } from "vitest";
import { isStale, RECOMMENDATION_TTL_MS } from "./freshness";

const NOW = new Date("2026-08-11T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("isStale by age", () => {
  it("is fresh just inside the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS - 60_000), "en", "en", NOW)).toBe(false);
  });

  it("is stale just outside the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS + 60_000), "en", "en", NOW)).toBe(true);
  });

  // The boundary itself. Twelve hours old has USED its twelve hours.
  it("is stale exactly at the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS), "en", "en", NOW)).toBe(true);
  });

  it("is stale for a timestamp it cannot parse", () => {
    expect(isStale("not a date", "en", "en", NOW)).toBe(true);
  });
});

/* The clause that stops someone who just switched to Spanish from reading
   English advice for the rest of the half-day window. */
describe("isStale by locale", () => {
  it("is stale when the text was written in another language", () => {
    expect(isStale(ago(60_000), "en", "es", NOW)).toBe(true);
  });

  it("is fresh when the language matches", () => {
    expect(isStale(ago(60_000), "es", "es", NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/overview/recommendation/freshness.test.ts`
Expected: FAIL — cannot resolve `./freshness`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/overview/recommendation/freshness.ts

/**
 * How long one recommendation stands before it is regenerated.
 *
 * Twelve hours, so a person who opens the app morning and evening gets two
 * different readings of their day, and someone who opens it eight times gets
 * one. The number is a product decision, not a technical limit — the row is
 * cheap to read and the regeneration is what costs.
 */
export const RECOMMENDATION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Whether a stored recommendation needs regenerating.
 *
 * Two independent reasons, and the second is the one that is easy to forget:
 * the text is GENERATED in a language rather than translated into one, so a
 * row written in English is wrong for a Spanish reader no matter how recent it
 * is. Age alone would leave someone who just switched languages staring at the
 * other one for up to twelve hours.
 *
 * An unparseable timestamp counts as stale. The alternative — treating it as
 * fresh — would pin a broken row in place permanently, and regenerating costs
 * one call.
 */
export function isStale(
  generatedAt: string,
  rowLocale: string,
  locale: string,
  now = new Date(),
): boolean {
  if (rowLocale !== locale) return true;
  const age = now.getTime() - new Date(generatedAt).getTime();
  return Number.isNaN(age) || age >= RECOMMENDATION_TTL_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/overview/recommendation/freshness.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/overview/recommendation/freshness.ts lib/overview/recommendation/freshness.test.ts
git commit -m "feat(overview): add recommendation freshness rule"
```

---

### Task 3: Tone type and colour mapping

**Files:**
- Create: `lib/overview/recommendation/tone.ts`
- Test: `lib/overview/recommendation/tone.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TONES: readonly ["good", "watch", "neutral"]`, `type Tone = "good" | "watch" | "neutral"`, `toneColor(tone: string): string` returning a CSS `var(...)` string, and `asTone(value: string): Tone`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/overview/recommendation/tone.test.ts
import { describe, expect, it } from "vitest";
import { asTone, toneColor } from "./tone";

describe("toneColor", () => {
  it.each([
    ["good", "var(--success)"],
    ["watch", "var(--warning)"],
    ["neutral", "var(--brand)"],
  ])("maps %s to %s", (tone, expected) => {
    expect(toneColor(tone)).toBe(expected);
  });

  /* The tone arrives from a model and then from a text column. The schema and
     the check constraint both narrow it, but neither runs on a row already
     written, so a value outside the set must render as something rather than
     paint the tile `undefined`. */
  it("falls back to the neutral colour for anything else", () => {
    expect(toneColor("magenta")).toBe("var(--brand)");
  });
});

describe("asTone", () => {
  it("passes through a known tone", () => {
    expect(asTone("watch")).toBe("watch");
  });

  it("narrows an unknown tone to neutral", () => {
    expect(asTone("URGENT")).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/overview/recommendation/tone.test.ts`
Expected: FAIL — cannot resolve `./tone`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/overview/recommendation/tone.ts

/**
 * How a recommendation feels, which is the only thing about it the UI can
 * colour. The model chooses it alongside the text so the tile agrees with the
 * sentence rather than being inferred from keywords in it.
 */
export const TONES = ["good", "watch", "neutral"] as const;
export type Tone = (typeof TONES)[number];

/**
 * Tokens that already exist in `app/globals.css` for both themes. Nothing new
 * is introduced here — `watch` borrows the same amber budgets already use for
 * "approaching", which is the same idea in a different place.
 */
const TONE_COLOR: Record<Tone, string> = {
  good: "var(--success)",
  watch: "var(--warning)",
  neutral: "var(--brand)",
};

export function asTone(value: string): Tone {
  return (TONES as readonly string[]).includes(value) ? (value as Tone) : "neutral";
}

export function toneColor(tone: string): string {
  return TONE_COLOR[asTone(tone)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/overview/recommendation/tone.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/overview/recommendation/tone.ts lib/overview/recommendation/tone.test.ts
git commit -m "feat(overview): add recommendation tone colour mapping"
```

---

### Task 4: The redacted snapshot (pure)

This is the task the whole feature's privacy story rests on. `buildSnapshot`
takes the RAW rows — names, UUIDs and all — and is responsible for dropping
them. Handing it pre-cleaned data would make its test prove nothing.

**Files:**
- Create: `lib/overview/recommendation/snapshot.ts`
- Test: `lib/overview/recommendation/snapshot.test.ts`

**Interfaces:**
- Consumes: `Overview` and `UpcomingItem` from `@/lib/overview/queries`, `BudgetRow` from `@/lib/budgets/queries`, `GoalCardRow` from `@/lib/goals/queries`.
- Produces: `type RecommendationSnapshot`, `type SnapshotRows`, and `buildSnapshot(rows: SnapshotRows): RecommendationSnapshot`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/overview/recommendation/snapshot.test.ts
import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotRows } from "./snapshot";

const NOW = new Date("2026-08-11T12:00:00Z");

/* Deliberately loaded with everything that must NOT survive: a person's name,
   their bank's name, the last four of a card, what they called their savings
   goal, and the UUIDs the upcoming rail keys on. */
const rows: SnapshotRows = {
  now: NOW,
  overview: {
    hasAccounts: true,
    baseCurrency: "USD",
    displayName: "Carlos Mendoza",
    netWorth: 12480.22,
    monthIncome: 4200.5,
    monthExpense: 2810.75,
    totalBudget: 3000,
    totalUsed: 2400,
    monthlySubscriptions: 64.99,
    upcoming: [
      {
        key: "card-6f1c2b7e-1111-4aaa-bbbb-000000000001",
        date: "2026-08-17T00:00:00.000Z",
        title: "BAC Credomatic Visa payment",
        subtitle: "Credit card · USD",
        amount: 340,
        currency: "USD",
      },
      {
        key: "sub-9d3e4f5a-2222-4ccc-dddd-000000000002",
        date: "2026-08-22T00:00:00.000Z",
        title: "Netflix",
        subtitle: "Subscription · USD",
        amount: 15.99,
        currency: "USD",
      },
    ],
  },
  budgets: [
    { category_id: "c1", name: "Dining", emoji: "🍽️", color: "#F79009", budget: 400, used: 320, remaining: 80, status: "approaching" },
    { category_id: "c2", name: "Transport", emoji: "🚗", color: "#12B76A", budget: 200, used: 60, remaining: 140, status: "within" },
    // Zero-budget categories are noise in a prompt: nothing can be "80% through"
    // a limit that was never set.
    { category_id: "c3", name: "Gifts", emoji: "🎁", color: null, budget: 0, used: 0, remaining: 0, status: "within" },
  ],
  goals: [
    {
      id: "g1",
      name: "Trip to Japan",
      emoji: "🗾",
      color: null,
      target_amount: 5000,
      target_date: "2026-12-01",
      saved: 3100,
      backed: 3100,
      shortfall: 0,
      pace: { kind: "on_track" } as GoalCardRowPace,
    },
  ],
  accounts: [
    { id: "a1", name: "BAC Credomatic Visa", type: "credit_card", currency: "USD", balance: -1200 },
    { id: "a2", name: "Banco Popular Ahorros", type: "savings", currency: "USD", balance: 4000 },
  ],
  loans: [{ currency: "USD", outstanding: 8200, installment: 310 }],
};

// `pace` is a discriminated union in lib/goals/pace.ts; the snapshot never reads
// it, so the test only needs something assignable.
type GoalCardRowPace = GoalCardRow["pace"];
import type { GoalCardRow } from "@/lib/goals/queries";

describe("buildSnapshot shape", () => {
  it("carries the core figures and the calendar position", () => {
    const s = buildSnapshot(rows);
    expect(s).toMatchObject({
      asOf: "2026-08-11",
      dayOfMonth: 11,
      daysLeftInMonth: 20,
      baseCurrency: "USD",
      netWorth: 12480,
      monthIncome: 4201,
      monthExpense: 2811,
      monthlySubscriptions: 65,
    });
  });

  it("keeps category names, which is what makes the advice specific", () => {
    expect(buildSnapshot(rows).budgets).toEqual([
      { category: "Dining", budget: 400, used: 320 },
      { category: "Transport", budget: 200, used: 60 },
    ]);
  });

  it("reduces upcoming items to a kind and a countdown", () => {
    expect(buildSnapshot(rows).upcoming).toEqual([
      { kind: "card_payment", amount: 340, currency: "USD", dueInDays: 6 },
      { kind: "subscription", amount: 16, currency: "USD", dueInDays: 11 },
    ]);
  });

  it("reduces goals to their numbers", () => {
    expect(buildSnapshot(rows).goals).toEqual([
      { target: 5000, saved: 3100, targetDate: "2026-12-01" },
    ]);
  });

  it("reduces accounts to type, currency and balance", () => {
    expect(buildSnapshot(rows).accounts).toEqual([
      { type: "credit_card", currency: "USD", balance: -1200 },
      { type: "savings", currency: "USD", balance: 4000 },
    ]);
  });
});

/**
 * The test that earns this module its existence. It asserts against the
 * SERIALISED snapshot, because what matters is what crosses the wire, not what
 * the type says. A column added to `getOverview()` later that quietly carries a
 * name into the prompt fails here.
 */
describe("buildSnapshot redaction", () => {
  const json = JSON.stringify(buildSnapshot(rows));

  it.each([
    ["the person's name", "Carlos"],
    ["the bank's name", "BAC Credomatic"],
    ["a second bank's name", "Banco Popular"],
    ["the subscription's name", "Netflix"],
    ["the goal's name", "Japan"],
    ["a card payment's human title", "payment"],
    ["an account UUID", "6f1c2b7e"],
    ["a subscription UUID", "9d3e4f5a"],
  ])("drops %s", (_label, secret) => {
    expect(json).not.toContain(secret);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/overview/recommendation/snapshot.test.ts`
Expected: FAIL — cannot resolve `./snapshot`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/overview/recommendation/snapshot.ts
import type { Overview, UpcomingItem } from "@/lib/overview/queries";
import type { BudgetRow } from "@/lib/budgets/queries";
import type { GoalCardRow } from "@/lib/goals/queries";

/**
 * What one person's finances look like to the model.
 *
 * Every field is a number, a currency code, a date, or a category name. That is
 * the whole privacy design: there is no field here a name could be put in, so
 * nothing has to remember not to put one there. `buildSnapshot` takes the raw
 * rows — names, UUIDs and all — precisely so the dropping happens in one place
 * with a test on it.
 *
 * Amounts are rounded to whole currency units. Coaching does not need cents,
 * and false precision spends tokens to make the model sound like a ledger.
 */
export type RecommendationSnapshot = {
  asOf: string;
  dayOfMonth: number;
  daysLeftInMonth: number;
  baseCurrency: string;
  netWorth: number;
  monthIncome: number;
  monthExpense: number;
  monthlySubscriptions: number;
  budgets: { category: string; budget: number; used: number }[];
  accounts: { type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
  goals: { target: number; saved: number; targetDate: string | null }[];
  upcoming: { kind: UpcomingKind; amount: number; currency: string; dueInDays: number }[];
};

export type SnapshotRows = {
  now: Date;
  overview: Overview;
  budgets: BudgetRow[];
  goals: GoalCardRow[];
  accounts: { id: string; name: string; type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
};

type UpcomingKind = "card_payment" | "loan_installment" | "subscription" | "other";

/* `UpcomingItem.key` is the only place the kind survives — `title` and
   `subtitle` are already translated prose and carry the account's name. The key
   also carries a UUID, so the prefix is taken and the rest discarded. */
const KIND_BY_PREFIX: Record<string, UpcomingKind> = {
  card: "card_payment",
  loan: "loan_installment",
  sub: "subscription",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function upcomingKind(item: UpcomingItem): UpcomingKind {
  return KIND_BY_PREFIX[item.key.split("-")[0]] ?? "other";
}

/** Whole days from `now` to `date`, floored at zero — an overdue item is "due
 *  today" to the model rather than a negative number it has to interpret. */
function dueInDays(date: string, now: Date): number {
  const days = Math.round((new Date(date).getTime() - now.getTime()) / MS_PER_DAY);
  return Math.max(days, 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysLeftInMonth(now: Date): number {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return end.getUTCDate() - now.getUTCDate();
}

export function buildSnapshot(rows: SnapshotRows): RecommendationSnapshot {
  const { now, overview: o } = rows;
  const r = Math.round;

  return {
    asOf: isoDate(now),
    dayOfMonth: now.getUTCDate(),
    daysLeftInMonth: daysLeftInMonth(now),
    baseCurrency: o.baseCurrency,
    netWorth: r(o.netWorth),
    monthIncome: r(o.monthIncome),
    monthExpense: r(o.monthExpense),
    monthlySubscriptions: r(o.monthlySubscriptions),
    // Categories with no limit set are dropped: nothing can be over, under or
    // approaching a budget of zero, so they are pure prompt noise.
    budgets: rows.budgets
      .filter((b) => b.budget > 0)
      .map((b) => ({ category: b.name, budget: r(b.budget), used: r(b.used) })),
    accounts: rows.accounts.map((a) => ({
      type: a.type,
      currency: a.currency,
      balance: r(a.balance),
    })),
    loans: rows.loans.map((l) => ({
      currency: l.currency,
      outstanding: r(l.outstanding),
      installment: r(l.installment),
    })),
    goals: rows.goals.map((g) => ({
      target: r(g.target_amount),
      saved: r(g.saved),
      targetDate: g.target_date,
    })),
    upcoming: o.upcoming.map((u) => ({
      kind: upcomingKind(u),
      amount: r(u.amount),
      currency: u.currency,
      dueInDays: dueInDays(u.date, now),
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/overview/recommendation/snapshot.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/overview/recommendation/snapshot.ts lib/overview/recommendation/snapshot.test.ts
git commit -m "feat(overview): build a redacted finance snapshot for inference"
```

---

### Task 5: Collecting the rows

**Files:**
- Create: `lib/overview/recommendation/collect.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `SnapshotRows`, `RecommendationSnapshot` from `./snapshot`; `getOverview` from `@/lib/overview/queries`; `getBudgetOverview` from `@/lib/budgets/queries`; `getGoalsOverview` from `@/lib/goals/queries`; `monthStart` from `@/lib/budgets/month`; `createClient` from `@/lib/supabase/server`.
- Produces: `collectSnapshot(now?: Date): Promise<RecommendationSnapshot | null>`.

No unit test: this file is a query fan-out with no logic of its own — everything
worth asserting lives in `buildSnapshot`, which Task 4 covers. It is verified by
`tsc` and by the manual check in Task 9.

- [ ] **Step 1: Write the implementation**

```ts
// lib/overview/recommendation/collect.ts
import { createClient } from "@/lib/supabase/server";
import { getOverview } from "@/lib/overview/queries";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { getGoalsOverview } from "@/lib/goals/queries";
import { monthStart } from "@/lib/budgets/month";
import { buildSnapshot, type RecommendationSnapshot } from "./snapshot";

/**
 * Gathers everything the model is shown, and hands it to `buildSnapshot` to be
 * stripped.
 *
 * This runs inside the refresh action, NOT during page render, so it does not
 * duplicate the `getOverview()` the overview page already makes — the two never
 * happen in the same request. That is also why the query count here is not
 * something to economise on.
 *
 * Returns null when there is nothing to talk about. A user with no accounts
 * sees the overview's empty state, which never mounts the card.
 */
export async function collectSnapshot(now = new Date()): Promise<RecommendationSnapshot | null> {
  const supabase = await createClient();

  const [overview, budgets, goals, { data: accounts }, { data: balances }, { data: cards }, { data: loans }] =
    await Promise.all([
      getOverview(),
      getBudgetOverview(monthStart(now)),
      getGoalsOverview(),
      supabase.from("accounts").select("id,name,type,currency").eq("is_archived", false),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("card_status").select("account_id,owed"),
      supabase.from("loan_status").select("currency,outstanding_balance,installment_amount"),
    ]);

  if (!overview.hasAccounts) return null;

  /* A card's `account_balances` row is not what it owes — `card_status.owed` is
     — and net worth already subtracts it. Cards are given as a NEGATIVE balance
     so the model reads a wallet as one list of positions rather than having to
     know which types invert. */
  const owedByCard = new Map((cards ?? []).map((c) => [c.account_id, Number(c.owed ?? 0)]));
  const balanceByAccount = new Map((balances ?? []).map((b) => [b.account_id, Number(b.balance)]));

  return buildSnapshot({
    now,
    overview,
    budgets: budgets.rows,
    goals: goals.goals,
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: owedByCard.has(a.id)
        ? -(owedByCard.get(a.id) ?? 0)
        : (balanceByAccount.get(a.id) ?? 0),
    })),
    loans: (loans ?? []).map((l) => ({
      currency: l.currency ?? overview.baseCurrency,
      outstanding: Number(l.outstanding_balance ?? 0),
      installment: Number(l.installment_amount ?? 0),
    })),
  });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/overview/recommendation/collect.ts
git commit -m "feat(overview): collect the rows the recommendation snapshot needs"
```

---

### Task 6: Inference

**Files:**
- Create: `lib/overview/recommendation/llm.ts`
- Test: `lib/overview/recommendation/llm.test.ts`

**Interfaces:**
- Consumes: `RecommendationSnapshot` from `./snapshot`; `Tone`, `asTone` from `./tone`; `DEFERRED_INFERENCE_BUDGET_MS`, `inferenceSignal` from `@/lib/llm/budget`.
- Produces: `type Recommendation = { headline: string; body: string; tone: Tone }` and `inferRecommendation(snapshot: RecommendationSnapshot, locale: string): Promise<Recommendation | null>`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/overview/recommendation/llm.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn(() => "model") }));

import { generateObject } from "ai";
import { inferRecommendation } from "./llm";
import type { RecommendationSnapshot } from "./snapshot";

const snapshot: RecommendationSnapshot = {
  asOf: "2026-08-11",
  dayOfMonth: 11,
  daysLeftInMonth: 20,
  baseCurrency: "USD",
  netWorth: 12480,
  monthIncome: 4201,
  monthExpense: 2811,
  monthlySubscriptions: 65,
  budgets: [{ category: "Dining", budget: 400, used: 320 }],
  accounts: [{ type: "savings", currency: "USD", balance: 4000 }],
  loans: [],
  goals: [],
  upcoming: [],
};

const mockReturn = (object: unknown) =>
  (generateObject as unknown as Mock).mockResolvedValue({ object });

const lastCall = () => (generateObject as unknown as Mock).mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inferRecommendation success", () => {
  it("returns the three fields", async () => {
    mockReturn({ headline: "Dining is running hot", body: "You are 80% through it.", tone: "watch" });
    expect(await inferRecommendation(snapshot, "en")).toEqual({
      headline: "Dining is running hot",
      body: "You are 80% through it.",
      tone: "watch",
    });
  });

  it("trims whitespace the model padded its answer with", async () => {
    mockReturn({ headline: "  Steady month  ", body: " Nothing needs attention. ", tone: "good" });
    expect(await inferRecommendation(snapshot, "en")).toMatchObject({
      headline: "Steady month",
      body: "Nothing needs attention.",
    });
  });

  /* The schema narrows `tone` to three strings, but a schema is a request, not
     a guarantee, and this value goes straight into a column with a CHECK on it.
     Narrowing here is what stops a refused insert from throwing away a good
     headline and body. */
  it("narrows a tone outside the set rather than failing", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "URGENT" });
    expect(await inferRecommendation(snapshot, "en")).toMatchObject({ tone: "neutral" });
  });
});

/**
 * Every way of coming back empty returns null, and the caller writes nothing.
 * A missing recommendation is a missing nicety — the card simply does not
 * render — so none of these is worth surfacing.
 */
describe("inferRecommendation comes back null rather than throwing", () => {
  it.each([
    ["an empty headline", { headline: "", body: "Something.", tone: "good" }],
    ["a whitespace headline", { headline: "   ", body: "Something.", tone: "good" }],
    ["an empty body", { headline: "Steady month", body: "", tone: "good" }],
  ])("on %s", async (_label, object) => {
    mockReturn(object);
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });

  it("when the call failed", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(new Error("boom"));
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });

  // An overrun is not special-cased: a slow guess is the same as no guess.
  it("when the call was aborted", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }),
    );
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });
});

describe("inferRecommendation call shape", () => {
  it("bounds the call with an abort signal", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "en");
    expect(lastCall().abortSignal).toBeInstanceOf(AbortSignal);
  });

  /* The text is GENERATED in a language, not translated into one, so the
     language has to reach the model. Naming it in the system prompt is the
     whole mechanism — there is nothing downstream that could correct it. */
  it("names the language in the system prompt", async () => {
    mockReturn({ headline: "Mes tranquilo", body: "Nada requiere atención.", tone: "good" });
    await inferRecommendation(snapshot, "es");
    expect(lastCall().system).toContain("Spanish");
  });

  it("falls back to English for a locale it does not know", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "fr");
    expect(lastCall().system).toContain("English");
  });

  it("sends the snapshot as the prompt", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "en");
    expect(lastCall().prompt).toContain("Dining");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/overview/recommendation/llm.test.ts`
Expected: FAIL — cannot resolve `./llm`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/overview/recommendation/llm.ts
import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { DEFERRED_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";
import { asTone, type Tone } from "./tone";
import type { RecommendationSnapshot } from "./snapshot";

/**
 * One short piece of coaching about a person's own numbers.
 *
 * The third sibling of `lib/subscriptions/llm/brand.ts` and
 * `lib/accounts/llm/card-art.ts`: same provider, same call shape, same refusal
 * to trust the answer as given. What differs is the input. Those two are handed
 * a NAME and asked to recognise it; this one is handed a redacted table of
 * figures and asked to read it — see `snapshot.ts` for what is deliberately
 * absent from that table and why.
 *
 * The model gets one call and returns all three fields. As with brand identity,
 * a second call to "pick a tone" would double a worst case measured in tens of
 * seconds to buy a field the first call returns for free.
 */
export const RecommendationSchema = z.object({
  headline: z
    .string()
    .describe("Three to six words naming the single thing worth noticing, in the requested language."),
  body: z
    .string()
    .describe("One or two sentences about it, in the requested language."),
  tone: z
    .enum(["good", "watch", "neutral"])
    .describe("watch when flagging a risk, good when the news is good, neutral otherwise."),
});

export type Recommendation = { headline: string; body: string; tone: Tone };

/* next-intl gives a locale; the model needs a language it recognises by name.
   An unknown locale falls back to English rather than to the raw code, which a
   model would otherwise try to interpret. */
const LANGUAGE: Record<string, string> = { en: "English", es: "Spanish" };

function systemPrompt(language: string): string {
  return `You are a calm, practical money coach inside a personal finance app. You are given a snapshot of one person's finances as JSON, and you write one short piece of coaching about it.

Write in ${language}. Every word you return must be in ${language}.

Return three things.

headline — three to six words naming the single thing you want them to notice. Concrete, not a category label: "Dining is running hot", never "Budget update".

body — one or two sentences. Say what you noticed and, where there is a useful one, what to do about it. Refer to real figures from the snapshot.

tone — "watch" when you are flagging something that needs attention, "good" when the news is genuinely good, "neutral" otherwise. It must match what your body text actually says.

Rules:
- Pick the SINGLE most notable thing. Do not survey the whole snapshot. This is read in four seconds.
- Use ONLY the numbers you were given. Never invent a figure and never estimate one. A difference or a percentage of two given numbers is fine; anything else is not.
- No investment, tax, or legal advice. Do not name financial products, banks, or services.
- Observe without scolding. Someone over budget already knows. Say what helps.
- Say something worth reading even on a quiet day: a goal on pace, a month tracking under budget, a card that is nearly paid off are all worth naming.
- Do not greet, do not sign off, do not ask questions, do not explain yourself.
- Amounts are in baseCurrency unless the line names its own currency.

The snapshot contains no names — not the person's, not their bank's, not their subscriptions'. Do not ask for them and do not pretend to know them.`;
}

/**
 * Never throws, and returns null on anything that is not a usable answer.
 *
 * `tone` is narrowed rather than rejected, because it is the one field with a
 * safe default: a good headline and body should not be thrown away over a word
 * the CHECK constraint would refuse. `headline` and `body` have no such
 * default — an empty card is worse than no card — so an empty one is null.
 *
 * A call that overruns DEFERRED_INFERENCE_BUDGET_MS aborts and is treated like
 * any other failure. The budget is generous because nothing waits on this: the
 * overview has already rendered, so a cold call costs a card that fills in
 * late rather than a spinner anyone sits behind.
 */
export async function inferRecommendation(
  snapshot: RecommendationSnapshot,
  locale: string,
): Promise<Recommendation | null> {
  try {
    const { object } = await generateObject({
      model: google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite"),
      schema: RecommendationSchema,
      system: systemPrompt(LANGUAGE[locale] ?? LANGUAGE.en),
      prompt: JSON.stringify(snapshot),
      abortSignal: inferenceSignal(DEFERRED_INFERENCE_BUDGET_MS),
    });

    const headline = object.headline?.trim() ?? "";
    const body = object.body?.trim() ?? "";
    if (!headline || !body) return null;

    return { headline, body, tone: asTone(object.tone) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/overview/recommendation/llm.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/overview/recommendation/llm.ts lib/overview/recommendation/llm.test.ts
git commit -m "feat(overview): infer a daily recommendation from the snapshot"
```

---

### Task 7: Reading the cached row

**Files:**
- Create: `lib/overview/recommendation/queries.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `isStale` from `./freshness`; `asTone` from `./tone`; `Recommendation` from `./llm`.
- Produces: `getRecommendation(locale: string): Promise<{ rec: Recommendation | null; stale: boolean }>`.

No unit test: the freshness decision it delegates to is covered by Task 2, and
what remains is a single `maybeSingle()` read.

- [ ] **Step 1: Write the implementation**

```ts
// lib/overview/recommendation/queries.ts
import { createClient } from "@/lib/supabase/server";
import { isStale } from "./freshness";
import { asTone } from "./tone";
import type { Recommendation } from "./llm";

/**
 * The cached recommendation, WHATEVER its age, plus whether it needs replacing.
 *
 * Returning a stale row rather than hiding it is what makes
 * stale-while-revalidate possible: the card shows this morning's reading
 * instantly and swaps in the new one when it lands, so the only blank card
 * anyone ever sees is on their first visit. Hiding it would trade a slightly
 * old sentence for an empty card for up to seventy seconds.
 *
 * No `.eq("user_id", ...)` filter — RLS scopes the row, exactly as the profile
 * read in `lib/overview/queries.ts` does.
 */
export async function getRecommendation(
  locale: string,
): Promise<{ rec: Recommendation | null; stale: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_recommendations")
    .select("headline,body,tone,locale,generated_at")
    .maybeSingle();

  if (!data) return { rec: null, stale: true };

  return {
    rec: { headline: data.headline, body: data.body, tone: asTone(data.tone) },
    stale: isStale(data.generated_at, data.locale, locale),
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/overview/recommendation/queries.ts
git commit -m "feat(overview): read the cached daily recommendation"
```

---

### Task 8: The refresh action

**Files:**
- Create: `app/(app)/actions.ts`

**Interfaces:**
- Consumes: `collectSnapshot` from `@/lib/overview/recommendation/collect`; `inferRecommendation` from `@/lib/overview/recommendation/llm`; `isStale` from `@/lib/overview/recommendation/freshness`; `createClient` from `@/lib/supabase/server`; `getLocale` from `next-intl/server`.
- Produces: `refreshRecommendation(): Promise<{ refreshed: boolean }>`.

- [ ] **Step 1: Write the implementation**

```ts
// app/(app)/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { collectSnapshot } from "@/lib/overview/recommendation/collect";
import { inferRecommendation } from "@/lib/overview/recommendation/llm";
import { isStale } from "@/lib/overview/recommendation/freshness";

/**
 * Regenerates the overview's recommendation, if it still needs regenerating.
 *
 * Called from the card on mount, never awaited by anything the user is waiting
 * on — see the `void` at the call site, which is load-bearing for the same
 * reason it is in `subscription-form-dialog.tsx`.
 *
 * Every failure is silent and returns `{ refreshed: false }`. Nothing here is
 * worth surfacing: the page has already rendered everything the person came
 * for, and a missing recommendation is a missing nicety the next visit retries.
 */
export async function refreshRecommendation(): Promise<{ refreshed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { refreshed: false };

  const locale = await getLocale();

  /* Re-read before spending a call. Two tabs opened together both mount the
     card and both see the same stale row; the second one arrives here after the
     first has written, and the cheapest place to notice is before the inference
     rather than after it. This is not a lock, and does not need to be — the
     worst case it fails to prevent is one wasted call. */
  const { data: existing } = await supabase
    .from("daily_recommendations")
    .select("locale,generated_at")
    .maybeSingle();
  if (existing && !isStale(existing.generated_at, existing.locale, locale)) {
    return { refreshed: false };
  }

  const snapshot = await collectSnapshot();
  if (!snapshot) return { refreshed: false };

  const rec = await inferRecommendation(snapshot, locale);
  if (!rec) return { refreshed: false };

  const { error } = await supabase.from("daily_recommendations").upsert(
    {
      user_id: user.id,
      headline: rec.headline,
      body: rec.body,
      tone: rec.tone,
      locale,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { refreshed: false };

  revalidatePath("/");
  return { refreshed: true };
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/actions.ts"
git commit -m "feat(overview): add the recommendation refresh action"
```

---

### Task 9: The card, the strings, and the page

**Files:**
- Create: `components/overview/recommendation-card.tsx`
- Modify: `messages/en.json` (the `Overview` object)
- Modify: `messages/es.json` (the `Overview` object)
- Modify: `app/(app)/page.tsx:31-33` (fetch), `app/(app)/page.tsx:147-150` (insert the card, renumber the rail)

**Interfaces:**
- Consumes: `getRecommendation` from `@/lib/overview/recommendation/queries`; `refreshRecommendation` from `@/app/(app)/actions`; `Recommendation` from `@/lib/overview/recommendation/llm`; `toneColor` from `@/lib/overview/recommendation/tone`; `Card` from `@/components/ui/card`; `ColorTile` from `@/components/ui/color-tile`.
- Produces: `<RecommendationCard rec={...} stale={...} />`.

- [ ] **Step 1: Add the strings to `messages/en.json`**

Inside the existing `"Overview"` object:

```json
    "recommendationTitle": "Today's take",
    "recommendationLoading": "Preparing today's take",
```

- [ ] **Step 2: Add the strings to `messages/es.json`**

Inside the existing `"Overview"` object:

```json
    "recommendationTitle": "Para hoy",
    "recommendationLoading": "Preparando lo de hoy",
```

- [ ] **Step 3: Write the card**

```tsx
// components/overview/recommendation-card.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";
import { toneColor } from "@/lib/overview/recommendation/tone";
import type { Recommendation } from "@/lib/overview/recommendation/llm";
import { refreshRecommendation } from "@/app/(app)/actions";

/**
 * Stale-while-revalidate, on the client because that is the only place a
 * generation this slow can be started without holding the page.
 *
 * `rec` renders immediately whatever its age; if `stale`, the action runs in
 * the background and `router.refresh()` swaps in the new text when it lands.
 * The person therefore reads this morning's sentence while this evening's is
 * being written, and the only blank card is the first one ever.
 */
export function RecommendationCard({
  rec,
  stale,
}: {
  rec: Recommendation | null;
  stale: boolean;
}) {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [pending, setPending] = useState(stale && !rec);
  /* React invokes effects twice in development. Without this the first visit
     spends two inference calls to write one row. */
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    setPending(!rec);

    /* `void` rather than `await`: this must never join anything the page is
       waiting on. Same reason it is voided in subscription-form-dialog.tsx. */
    void refreshRecommendation().then(({ refreshed }) => {
      setPending(false);
      if (refreshed) router.refresh();
    });
  }, [stale, rec, router]);

  if (rec) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <ColorTile color={toneColor(rec.tone)} icon={Sparkles} size="md" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("recommendationTitle")}</p>
            <p className="mt-0.5 font-medium text-foreground">{rec.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rec.body}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (pending) {
    return (
      <Card className="p-5" aria-busy aria-label={t("recommendationLoading")}>
        <div className="flex items-start gap-3">
          <div className="skeleton size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  /* Nothing cached and nothing coming. No error, no retry button — an absent
     recommendation is a missing nicety, and the page reads fine without it. */
  return null;
}
```

- [ ] **Step 4: Fetch the recommendation in the page**

In `app/(app)/page.tsx`, add the imports:

```tsx
import { getRecommendation } from "@/lib/overview/recommendation/queries";
import { RecommendationCard } from "@/components/overview/recommendation-card";
```

and fetch it alongside the locale (after the existing `const locale = await getLocale();` on line 33):

```tsx
  const { rec, stale } = await getRecommendation(locale);
```

This sits AFTER the `if (!o.hasAccounts)` early return is set up but must be
placed BEFORE that branch runs — put it directly under the `locale` line, which
is above the empty-state block. The empty-state branch does not render the card,
so the read is one extra indexed query on a page that already makes eight.

- [ ] **Step 5: Insert the card and renumber the rail**

Between the closing `</div>` of the stat grid (currently `app/(app)/page.tsx:147`)
and the Upcoming rail block, insert:

```tsx
      {/* Coaching, after the figures it is about. */}
      <div className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <RecommendationCard rec={rec} stale={stale} />
      </div>
```

and change the Upcoming rail's opening div from `"--i": 5` to `"--i": 6`:

```tsx
      <div className="rise space-y-3" style={{ "--i": 6 } as React.CSSProperties}>
```

- [ ] **Step 6: Verify the whole suite, types and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 7: Verify in the running app**

Run: `npm run dev`, sign in, open `/`.
Expected, in order:
1. First load with no row: the stat grid renders immediately, a skeleton sits below it, and within 90 seconds a headline and body appear without a page reload.
2. Reload: the text renders immediately with no skeleton, and no second inference runs.
3. Switch the language in settings and return to `/`: the previous text shows briefly, then is replaced by text in the new language.
4. Check the row: `tone` is one of `good`/`watch`/`neutral` and the tile's colour matches it.

- [ ] **Step 8: Commit**

```bash
git add components/overview/recommendation-card.tsx messages/en.json messages/es.json "app/(app)/page.tsx"
git commit -m "feat(overview): show the daily recommendation card"
```

---

## Self-review notes

Checked against the spec:

- Storage, RLS, freshness, snapshot, redaction, inference, prompt guardrails, read/refresh, card states, tone tokens, i18n and testing all map to tasks 1–9.
- The spec's fourth test row ("recommendation-card tone map") became Task 3, a pure `tone.ts` module, because `vitest.config.ts` has no jsdom environment and a component render would not run. The behaviour is unchanged; the seam moved.
- The spec did not say where cards' balances come from. Task 5 resolves it explicitly: `card_status.owed`, negated, because `account_balances` does not mean "owed" for a card.
- Zero-budget categories are filtered out in `buildSnapshot` (Task 4). The spec did not mention them; they are noise the model would otherwise have to ignore.
