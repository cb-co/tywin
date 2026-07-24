# Import Performance, Route Skeletons & Button Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Import button from silently re-running the whole PDF-extraction + Gemini pipeline, add per-route loading skeletons so accounts↔account-detail (and other) navigation no longer feels frozen, lazy-load the heaviest chart bundles, and give every long-running button a real loading state instead of just `disabled`.

**Architecture:** Split `runPipeline()` in `app/(app)/accounts/statement-actions.ts` into an expensive `extractAndParse()` (PDF/PII/Gemini) called only on parse, and a cheap `loadAccountContext()` (DB lookups) called by both parse and confirm; the client now echoes the already-parsed statement back to the server on Import instead of re-uploading the PDF. Add one `loading.tsx` per route (Next.js file-convention Suspense boundaries, no manual `Suspense`), reusing the existing `.skeleton` CSS utility. Wrap the four recharts-based components in client-only `next/dynamic` wrappers. Add an `isLoading` prop to the shared `Button` and roll it out across every async button call site.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), React 19, `@ai-sdk/google` (Gemini), Supabase (`@supabase/ssr`), `lucide-react`, `class-variance-authority`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-24-import-perf-loading-states-design.md`

## Global Constraints

- No PDF bytes, no `extractStatementText` call, and no `extractWithLLM` (Gemini) call may happen during `confirmStatementImport` — it must reuse the `ParsedStatement` the client already received from `parseStatement`. (Spec §1)
- `confirmStatementImport` still re-runs `validateChecksums()` on the incoming payload as a cheap defensive check — this is not a new trust boundary, just removed redundant recomputation. (Spec §1)
- No manual `React.Suspense` boundaries — stay on the app's existing file-convention-only `loading.tsx` pattern. (Spec §5)
- No new spinner/skeleton dependency — use `lucide-react`'s `Loader2Icon` and the existing `.skeleton` CSS class (`app/globals.css:321-345`). (Spec §5)
- `Button`'s `isLoading` prepends a spinner ahead of `children` unconditionally; icon-only call sites omit their own icon while loading instead of adding branching inside `Button`. (Spec §4)
- Do not touch the `statement_imports` failure-telemetry inserts — they stay in `extractAndParse` only. (Spec §5)

---

### Task 1: Write the failing regression test for the duplicate-pipeline bug

**Files:**
- Create: `app/(app)/accounts/statement-actions.test.ts`

**Interfaces:**
- Consumes: `confirmStatementImport(formData: FormData): Promise<{ error?: string }>` — current signature, unchanged by this task (it still requires a `file`, `account_id`, `mappings` at this point; this task only adds a test file, no production code changes yet).
- Produces: nothing new — this task is red-only. Task 2 changes `confirmStatementImport`'s accepted `FormData` shape to make this test pass.

This test asserts the fix, not the current behavior — it is expected to **fail** against today's code, because today's `confirmStatementImport` always re-extracts the PDF and re-calls the LLM. That failure is the point: it proves the regression is real and gives Task 2 a concrete target.

- [ ] **Step 1: Write the test**

```ts
// app/(app)/accounts/statement-actions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/statements/extract", () => ({ extractStatementText: vi.fn() }));
vi.mock("@/lib/statements/llm/extract", () => ({
  extractWithLLM: vi.fn(),
  toParsedStatement: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/fx", () => ({ getExchangeRates: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { extractStatementText } from "@/lib/statements/extract";
import { extractWithLLM } from "@/lib/statements/llm/extract";
import { createClient } from "@/lib/supabase/server";
import { confirmStatementImport } from "./statement-actions";
import type { ParsedStatement } from "@/lib/statements/types";

/** Minimal fake Supabase query builder: chainable select/eq, terminal
 *  single/maybeSingle, and awaitable directly (bare `await supabase.from(...).select(...)`
 *  with no terminal call) via `.then`. `extra` lets a table also expose e.g. `upsert`. */
function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

function makeSupabaseStub() {
  const account = {
    id: "acc-1",
    name: "Test Card",
    currency: "DOP",
    credit_limit: 10000,
    card_group_id: null,
    type: "credit_card",
  };
  const byTable: Record<string, () => unknown> = {
    accounts: () => chainable({ data: account }),
    statement_section_mappings: () =>
      chainable({ data: [] }, { upsert: vi.fn(() => Promise.resolve({ error: null })) }),
    categories: () => chainable({ data: [{ id: "cat-other", name: "Other" }] }),
    category_rules: () => chainable({ data: [] }),
    profiles: () => chainable({ data: { base_currency: "DOP" } }),
  };
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => (byTable[table] ?? (() => chainable({ data: null })))()),
    rpc: vi.fn(async () => ({ error: null })),
  };
}

const PARSED: ParsedStatement = {
  parserId: "visa_1234_dop",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodStart: "2026-05-26",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalanceCents: 100000,
      totalDebitsCents: 50000,
      totalCreditsCents: 0,
      closingBalanceCents: 150000,
      balanceToPayCents: 150000,
      minimumPaymentCents: 15000,
      overdueAmountCents: null,
      overdueInstallments: null,
      creditLimitCents: 1000000,
      availableCreditCents: 850000,
      interestRateAnnual: 40,
      avgDailyBalanceCents: 120000,
      avgDailyBalancePriorCents: null,
      costOfCarryCents: 4000,
      costOfCarryPriorCents: null,
      lines: [
        {
          lineNo: 1,
          madeOn: "2026-06-01",
          postedOn: "2026-06-01",
          reference: null,
          description: "MERCADO UNO",
          mcc: "5411",
          authCode: null,
          amountCents: 50000,
          kind: "purchase",
          suggestedCategory: "Groceries",
        },
      ],
    },
  ],
};

function buildConfirmFormData() {
  const fd = new FormData();
  fd.set("account_id", "acc-1");
  fd.set("file_name", "statement.pdf");
  fd.set("mappings", JSON.stringify({ DOP: "acc-1" }));
  fd.set("parsed_statement", JSON.stringify(PARSED));
  return fd;
}

describe("confirmStatementImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(makeSupabaseStub());
  });

  it("does not re-extract the PDF or call the LLM given a valid parsed_statement payload", async () => {
    const result = await confirmStatementImport(buildConfirmFormData());
    expect(result.error).toBeUndefined();
    expect(extractStatementText).not.toHaveBeenCalled();
    expect(extractWithLLM).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`

Expected: **FAIL**. Today's `confirmStatementImport` requires a `file` field (not `parsed_statement`/`file_name`) and unconditionally calls `runPipeline`, which calls the now-mocked `extractStatementText`/`extractWithLLM` — since the test's `FormData` has no `file`, `runPipeline` returns an `invalidUpload` error early, so `result.error` is defined (failing the `toBeUndefined()` assertion). This is the expected red state.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/accounts/statement-actions.test.ts"
git commit -m "$(cat <<'EOF'
test(statements): add failing regression test for duplicate Import LLM call

confirmStatementImport re-runs the full extract+LLM pipeline today even
though the preview already parsed the file. This test pins the target
behavior (confirm must not touch extractStatementText/extractWithLLM) so
the next commit's fix has a concrete, verifiable target.
EOF
)"
```

---

### Task 2: Split the pipeline so confirm reuses the already-parsed statement

**Files:**
- Modify: `app/(app)/accounts/statement-actions.ts`

**Interfaces:**
- Consumes: `extractStatementText`, `scrubPii`, `extractWithLLM`, `toParsedStatement`, `validateChecksums`, `resolveCategoryId`, `suggestAccountId`, `getExchangeRates`, `dbError`, `centsToDecimal` — all unchanged imports from Task 1's test-mocked modules.
- Produces:
  - `StatementPreviewResult` gains `parsedStatement?: string` (JSON-serialized `ParsedStatement`), alongside the existing `preview` field. Consumed by Task 3.
  - `confirmStatementImport(formData)` now reads `account_id`, `file_name`, `mappings`, and `parsed_statement` from `formData` — **no `file` field anymore**. Consumed by Task 3.

- [ ] **Step 1: Replace `runPipeline` with `loadAccountContext` + `extractAndParse`, and update `parseStatement`/`confirmStatementImport`**

Replace the entire file `app/(app)/accounts/statement-actions.ts` with:

```ts
"use server";

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { extractStatementText } from "@/lib/statements/extract";
import { scrubPii } from "@/lib/statements/llm/scrub-pii";
import { extractWithLLM, toParsedStatement } from "@/lib/statements/llm/extract";
import { validateChecksums } from "@/lib/statements/validate";
import { centsToDecimal } from "@/lib/statements/money";
import { suggestAccountId, type CardAccountOption } from "@/lib/statements/mapping";
import { resolveCategoryId, type CategoryRuleRow } from "@/lib/statements/categorize";
import { getExchangeRates } from "@/lib/fx";
import type { ParsedStatement } from "@/lib/statements/types";

export interface SectionPreview {
  sectionKey: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  closingBalance: string;
  costOfCarry: string | null;
  lineCount: number;
  paymentCount: number;
  creditLimit: string | null;
  mappedAccountId: string | null;
  suggestedAccountId: string | null;
}
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  passwordIncorrect?: boolean;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    cardGroupId: string | null;
    needsMapping: boolean;
    sections: SectionPreview[];
    accountOptions: { id: string; name: string; currency: string }[];
  };
  /** JSON-serialized ParsedStatement. The client echoes this back on Import
   *  (confirmStatementImport) so confirm never re-extracts the PDF or re-calls
   *  the LLM — see design spec §1. */
  parsedStatement?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Cheap half of the old runPipeline: account, card-group siblings, and saved
 *  section mappings for one card account + parser. No PDF/LLM work — safe to
 *  call on every parse AND every confirm. */
async function loadAccountContext(supabase: Supabase, accountId: string, parserId: string) {
  const t = await getTranslations("Statements");
  const { data: account } = await supabase
    .from("accounts")
    .select("id,name,currency,credit_limit,card_group_id,type")
    .eq("id", accountId)
    .single();
  if (!account || account.type !== "credit_card") return { error: t("notACard") } as const;

  let options: CardAccountOption[] = [
    { id: account.id, name: account.name, currency: account.currency, credit_limit: account.credit_limit },
  ];
  if (account.card_group_id) {
    const { data: group } = await supabase
      .from("accounts")
      .select("id,name,currency,credit_limit")
      .eq("card_group_id", account.card_group_id)
      .eq("type", "credit_card")
      .eq("is_archived", false);
    if (group?.length) options = group;
  }

  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parserId)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { account, options, saved } as const;
}

/** Expensive half of the old runPipeline: PDF extraction, PII scrub, and the
 *  Gemini call. Only ever run on parse — see design spec §1: this step used
 *  to be a cheap local regex (detectParser) and confirm re-ran it for free;
 *  it's an LLM network call now, so confirm must not repeat it. */
async function extractAndParse(formData: FormData) {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;

  const file = formData.get("file");
  const password = String(formData.get("password") ?? "") || undefined;
  if (!(file instanceof File)) return { error: t("invalidUpload") } as const;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    if (extracted.reason === "bad_password") return { needsPassword: true, passwordIncorrect: true } as const;
    return { needsPassword: true } as const;
  }

  // Local dev debugging aid only (see design spec §9 of the LLM extraction
  // spec): dumps the raw, pre-scrub extraction so a developer can inspect what
  // pdfjs pulled from a real statement. Vercel's filesystem is read-only
  // outside /tmp, so this throws there — caught and ignored.
  try {
    await writeFile(path.join(process.cwd(), "extracted-statement.txt"), extracted.text, { mode: 0o600 });
  } catch {
    // best-effort local debug aid; ignore in read-only environments (e.g. Vercel)
  }

  const llmResult = await extractWithLLM(scrubPii(extracted.text));
  if (!llmResult.ok) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: llmResult.reason === "rate_limited" ? "llm rate limited" : "llm extraction failed",
    });
    return { error: llmResult.reason === "rate_limited" ? t("llmRateLimited") : t("unsupportedBank") } as const;
  }

  let parsed: ParsedStatement;
  try {
    parsed = toParsedStatement(llmResult.statement);
  } catch (e) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: String(e),
    });
    return { error: t("parseFailed") } as const;
  }

  const failures = validateChecksums(parsed);
  if (failures.length) {
    const detail = failures
      .map((f) => `${f.sectionKey}: ${centsToDecimal(f.computedCents)} ≠ ${centsToDecimal(f.statedCents)}`)
      .join("; ");
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parsed.parserId,
      file_name: file.name,
      status: "failed_validation",
      error: detail,
    });
    return { error: t("checksumFailed", { detail }) } as const;
  }

  return { supabase, fileName: file.name, parsed } as const;
}

export async function parseStatement(formData: FormData): Promise<StatementPreviewResult> {
  const t = await getTranslations("Statements");
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) return { error: t("invalidUpload") };

  const ctx = await extractAndParse(formData);
  if ("error" in ctx || "needsPassword" in ctx) return ctx as StatementPreviewResult;
  const { supabase, parsed, fileName } = ctx;

  const accountCtx = await loadAccountContext(supabase, accountId, parsed.parserId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { account, options, saved } = accountCtx;

  const sections: SectionPreview[] = parsed.sections.map((s) => {
    const mapped =
      saved.get(s.sectionKey) ??
      (parsed.sections.length === 1 && options.length === 1 ? options[0].id : null);
    return {
      sectionKey: s.sectionKey,
      currency: s.currency,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      dueDate: s.dueDate,
      closingBalance: centsToDecimal(s.closingBalanceCents),
      costOfCarry: s.costOfCarryCents === null ? null : centsToDecimal(s.costOfCarryCents),
      lineCount: s.lines.filter((l) => l.kind !== "payment").length,
      paymentCount: s.lines.filter((l) => l.kind === "payment").length,
      creditLimit: s.creditLimitCents === null ? null : centsToDecimal(s.creditLimitCents),
      mappedAccountId: mapped,
      suggestedAccountId: mapped ?? suggestAccountId(s, options),
    };
  });

  return {
    preview: {
      parserId: parsed.parserId,
      cardLast4: parsed.cardLast4,
      fileName,
      cardGroupId: account.card_group_id,
      needsMapping: sections.some((s) => !s.mappedAccountId),
      sections,
      accountOptions: options.map(({ id, name, currency }) => ({ id, name, currency })),
    },
    parsedStatement: JSON.stringify(parsed),
  };
}

/** Lightweight shape guard for the client-echoed parsed statement — same
 *  spirit as the `mappings` JSON guard below: not a new trust boundary (a
 *  caller could already forge arbitrary FormData today), just protects
 *  against a corrupted/stale payload crashing the RPC downstream. */
function parseIncomingStatement(raw: string): ParsedStatement | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as ParsedStatement).parserId !== "string" ||
    !Array.isArray((value as ParsedStatement).sections)
  ) {
    return null;
  }
  return value as ParsedStatement;
}

export async function confirmStatementImport(formData: FormData): Promise<{ error?: string }> {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };

  const accountId = String(formData.get("account_id") ?? "");
  const fileName = String(formData.get("file_name") ?? "");
  const parsed = parseIncomingStatement(String(formData.get("parsed_statement") ?? ""));
  if (!accountId || !fileName || !parsed) return { error: t("invalidUpload") };

  // Defense-in-depth against a corrupted/stale client payload — cheap, pure,
  // no re-extraction. See design spec §1.
  const failures = validateChecksums(parsed);
  if (failures.length) {
    return { error: t("checksumFailed", { detail: failures.map((f) => f.sectionKey).join(", ") }) };
  }

  const accountCtx = await loadAccountContext(supabase, accountId, parsed.parserId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { account, options } = accountCtx;

  let mappings: Record<string, string>;
  try {
    const raw: unknown = JSON.parse(String(formData.get("mappings") ?? "{}"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
    mappings = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  } catch {
    return { error: t("invalidUpload") };
  }
  const optionById = new Map(options.map((o) => [o.id, o]));

  // Every section must land on a currency-matching card the user owns.
  for (const s of parsed.sections) {
    const target = mappings[s.sectionKey];
    const opt = target ? optionById.get(target) : undefined;
    if (!opt) return { error: t("unmappedSection", { section: s.sectionKey }) };
    if (opt.currency !== s.currency)
      return { error: t("currencyMismatch", { section: s.sectionKey, currency: s.currency }) };
  }

  // Two sections mapped to the same account would each delete-by-(account,
  // period_end) in the RPC, so the second section's import silently destroys
  // the first's — reject the duplicate before it ever reaches the database.
  const mappedIds = parsed.sections.map((s) => mappings[s.sectionKey]);
  if (new Set(mappedIds).size !== mappedIds.length) return { error: t("duplicateMapping") };

  // Category resolution inputs.
  const [{ data: cats }, { data: ruleRows }, { data: profile }] = await Promise.all([
    supabase.from("categories").select("id,name"),
    supabase.from("category_rules").select("rule_type,pattern,category_id,priority"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const otherId = categoryIdByName.get("Other") ?? cats?.[0]?.id;
  if (!otherId) return { error: t("noCategories") };
  const rules = (ruleRows ?? []) as CategoryRuleRow[];
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);

  const payload = {
    parser_id: parsed.parserId,
    card_group_id: account.card_group_id ?? "",
    file_name: fileName,
    file_path: "",
    sections: parsed.sections.map((s) => {
      const rate = s.currency === baseCurrency ? 1 : rates[s.currency] ? 1 / rates[s.currency] : 1;
      const fxFallback = s.currency !== baseCurrency && !rates[s.currency];
      return {
        account_id: mappings[s.sectionKey],
        section_key: s.sectionKey,
        period_start: s.periodStart,
        period_end: s.periodEnd,
        due_date: s.dueDate ?? "",
        previous_balance: centsToDecimal(s.previousBalanceCents),
        total_debits: centsToDecimal(s.totalDebitsCents),
        total_credits: centsToDecimal(s.totalCreditsCents),
        statement_balance: centsToDecimal(s.balanceToPayCents),
        total_balance: centsToDecimal(s.closingBalanceCents),
        minimum_payment: s.minimumPaymentCents === null ? "" : centsToDecimal(s.minimumPaymentCents),
        overdue_amount: s.overdueAmountCents === null ? "" : centsToDecimal(s.overdueAmountCents),
        overdue_installments: s.overdueInstallments === null ? "" : String(s.overdueInstallments),
        credit_limit: s.creditLimitCents === null ? "" : centsToDecimal(s.creditLimitCents),
        available_credit: s.availableCreditCents === null ? "" : centsToDecimal(s.availableCreditCents),
        interest_rate_annual: s.interestRateAnnual === null ? "" : String(s.interestRateAnnual),
        avg_daily_balance: s.avgDailyBalanceCents === null ? "" : centsToDecimal(s.avgDailyBalanceCents),
        avg_daily_balance_prior:
          s.avgDailyBalancePriorCents === null ? "" : centsToDecimal(s.avgDailyBalancePriorCents),
        cost_of_carry: s.costOfCarryCents === null ? "" : centsToDecimal(s.costOfCarryCents),
        cost_of_carry_prior:
          s.costOfCarryPriorCents === null ? "" : centsToDecimal(s.costOfCarryPriorCents),
        exchange_rate: String(rate),
        fx_fallback: fxFallback,
        lines: s.lines.map((l) => ({
          line_no: String(l.lineNo),
          made_on: l.madeOn,
          posted_on: l.postedOn,
          reference: l.reference ?? "",
          description: l.description,
          mcc: l.mcc ?? "",
          auth_code: l.authCode ?? "",
          amount: centsToDecimal(l.amountCents),
          kind: l.kind,
          category_id:
            l.kind === "payment" ? "" : resolveCategoryId(l, rules, categoryIdByName, otherId),
        })),
      };
    }),
  };

  const { error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };

  // Remember confirmed mappings for zero-touch future imports.
  if (account.card_group_id) {
    const cardGroupId = account.card_group_id;
    for (const s of parsed.sections) {
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parsed.parserId,
          card_group_id: cardGroupId,
          section_key: s.sectionKey,
          account_id: mappings[s.sectionKey],
        },
        { onConflict: "user_id,parser_id,card_group_id,section_key" },
      );
    }
  }

  revalidatePath("/accounts");
  for (const id of new Set(parsed.sections.map((s) => mappings[s.sectionKey])))
    revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/insights");
  return {};
}

export async function deleteCardStatement(id: string, accountId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("card_statements").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteCardStatement") };
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/");
  return {};
}

export async function saveMerchantRule(pattern: string, categoryId: string): Promise<{ error?: string }> {
  const trimmed = pattern.trim();
  if (!trimmed) return { error: "empty pattern" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("category_rules").upsert(
    { user_id: user.id, rule_type: "merchant", pattern: trimmed, category_id: categoryId, priority: 10 },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (error) return { error: await dbError(error, "saveMerchantRule") };
  return {};
}

export interface StatementLineDetail {
  id: string;
  lineNo: number;
  madeOn: string;
  description: string;
  mcc: string | null;
  amount: number;
  kind: "purchase" | "fee" | "credit" | "payment";
}

export async function getStatementLineDetail(statementId: string): Promise<StatementLineDetail[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase
    .from("card_statement_lines")
    .select("id,line_no,made_on,description,mcc,amount,kind")
    .eq("statement_id", statementId)
    .order("line_no");
  return (data ?? []).map((l) => ({
    id: l.id,
    lineNo: l.line_no,
    madeOn: l.made_on,
    description: l.description,
    mcc: l.mcc,
    amount: l.amount,
    kind: l.kind,
  }));
}
```

- [ ] **Step 2: Run Task 1's test and confirm it now passes**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`

Expected: **PASS**.

- [ ] **Step 3: Run the full statements test suite to confirm no regressions**

Run: `npx vitest run lib/statements`

Expected: **PASS** — `validate.test.ts`, `categorize.test.ts`, `mapping.test.ts`, `money.test.ts`, `dates.test.ts`, `registry.test.ts`, `parsers/*.test.ts`, and `llm/*.test.ts` are all pure-function tests unaffected by this change; they should still pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/accounts/statement-actions.ts"
git commit -m "$(cat <<'EOF'
fix(statements): stop Import from re-running PDF extraction and the Gemini call

confirmStatementImport shared runPipeline with parseStatement, so every
Import click re-extracted the PDF and re-called Gemini even though the
preview had already parsed it — a duplicate that used to be a cheap regex
before the LLM switch. Split into extractAndParse (parse-only) and
loadAccountContext (cheap DB lookups, shared); confirm now consumes the
parsed statement the client already has instead of re-deriving it.
EOF
)"
```

---

### Task 3: Wire the client to send the parsed statement instead of re-uploading the PDF

**Files:**
- Modify: `components/accounts/statements-panel.tsx`

**Interfaces:**
- Consumes: `StatementPreviewResult` (now including `parsedStatement?: string`) and `confirmStatementImport`'s new `FormData` contract (`account_id`, `file_name`, `parsed_statement`, `mappings`) from Task 2.
- Produces: no new exports — internal component state only.

No automated test for this task (no component-test infra in this repo — see `docs/superpowers/plans/2026-07-20-pwa-support.md` Task 1 for the same precedent). Verified manually in Step 3.

- [ ] **Step 1: Add `parsedStatement` state and capture it on parse**

In `components/accounts/statements-panel.tsx`, change:

```ts
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
```

to:

```ts
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsedStatement, setParsedStatement] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
```

Change `onParse`:

```ts
  function onParse(f: File) {
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) {
        setNeedsPassword(true);
        setPasswordIncorrect(!!result.passwordIncorrect);
        if (result.passwordIncorrect) setPassword("");
        return;
      }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed"));
        playError();
        return;
      }
      setNeedsPassword(false);
      setPasswordIncorrect(false);
      setPreview(result.preview);
      setMappings(
        Object.fromEntries(
          result.preview.sections
            .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
            .filter(([, v]) => v),
        ),
      );
    });
  }
```

to:

```ts
  function onParse(f: File) {
    setParsedStatement(null);
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) {
        setNeedsPassword(true);
        setPasswordIncorrect(!!result.passwordIncorrect);
        if (result.passwordIncorrect) setPassword("");
        return;
      }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed"));
        playError();
        return;
      }
      setNeedsPassword(false);
      setPasswordIncorrect(false);
      setPreview(result.preview);
      setParsedStatement(result.parsedStatement ?? null);
      setMappings(
        Object.fromEntries(
          result.preview.sections
            .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
            .filter(([, v]) => v),
        ),
      );
    });
  }
```

- [ ] **Step 2: Rebuild `onConfirm` to send the parsed statement instead of the file**

Change:

```ts
  function onConfirm() {
    if (!file || !preview) return;
    const fd = buildFormData(file);
    fd.set("mappings", JSON.stringify(mappings));
    startTransition(async () => {
      const result = await confirmStatementImport(fd);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("imported"));
      playSuccess();
      setPreview(null);
      setFile(null);
      setPassword("");
      router.refresh();
    });
  }
```

to:

```ts
  function onConfirm() {
    if (!preview || !parsedStatement) return;
    const fd = new FormData();
    fd.set("account_id", accountId);
    fd.set("file_name", preview.fileName);
    fd.set("parsed_statement", parsedStatement);
    fd.set("mappings", JSON.stringify(mappings));
    startTransition(async () => {
      const result = await confirmStatementImport(fd);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("imported"));
      playSuccess();
      setPreview(null);
      setFile(null);
      setPassword("");
      setParsedStatement(null);
      router.refresh();
    });
  }
```

- [ ] **Step 3: Clear `parsedStatement` at the other two places `preview` is reset**

Change the file-input `onChange` handler:

```ts
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setPassword("");
            setNeedsPassword(false);
            setPasswordIncorrect(false);
            setPreview(null);
            onParse(f);
          }}
```

to:

```ts
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setPassword("");
            setNeedsPassword(false);
            setPasswordIncorrect(false);
            setPreview(null);
            setParsedStatement(null);
            onParse(f);
          }}
```

Change the preview Cancel button:

```ts
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setFile(null);
                setPassword("");
              }}
            >
              {t("cancelButton")}
            </Button>
```

to:

```ts
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setFile(null);
                setPassword("");
                setParsedStatement(null);
              }}
            >
              {t("cancelButton")}
            </Button>
```

- [ ] **Step 4: Manually verify in dev**

Run: `npm run dev`

1. Open an existing credit-card account, use **Import** to upload a real (or test) statement PDF.
2. Confirm the preview appears as before, map any unmapped sections, click **Import** (the confirm button).
3. Confirm the import succeeds (success toast, statement appears in the list) and check the terminal running `npm run dev` — you should see exactly **one** Gemini call logged for the whole flow (via any request logging you have, or simply that the confirm step now completes near-instantly compared to before, since no second PDF parse/LLM round-trip happens).
4. Try the password-protected-PDF retry path once to confirm it's unaffected.

- [ ] **Step 5: Commit**

```bash
git add "components/accounts/statements-panel.tsx"
git commit -m "$(cat <<'EOF'
fix(statements): send the already-parsed statement on Import, not the PDF

Client-side half of the confirmStatementImport fix: onConfirm now echoes
back the ParsedStatement parseStatement already returned, instead of
re-uploading the raw file for the server to re-extract and re-parse.
EOF
)"
```

---

### Task 4: Add per-route loading skeletons

**Files:**
- Create: `app/(app)/accounts/loading.tsx`
- Create: `app/(app)/accounts/[id]/loading.tsx`
- Create: `app/(app)/subscriptions/loading.tsx`
- Create: `app/(app)/budgets/loading.tsx`
- Create: `app/(app)/insights/loading.tsx`
- Create: `app/(app)/transactions/loading.tsx`
- Create: `app/(app)/settings/loading.tsx`

**Interfaces:**
- Consumes: the `.skeleton` CSS utility class already defined in `app/globals.css:321-345` (shimmer animation) — no new CSS.
- Produces: nothing consumed by other tasks — these are Next.js file-convention loading UIs, picked up automatically by the router.

Note: `app/(app)/page.tsx` (the dashboard) is **not** in this list — it already has a dedicated loading boundary via the existing `app/(app)/loading.tsx` (a `loading.tsx` wraps the `page.tsx` in the *same* folder, not just its children), which is already reasonably shaped to the dashboard's own layout. The 7 routes above currently fall through to that same generic group-level boundary, which is too far up the tree to fire on sibling navigation within `(app)` (e.g. `/accounts` → `/accounts/[id]`) — that's the "frozen" symptom this task fixes.

No automated test — Next.js `loading.tsx` files are picked up by file convention and rendered by the framework; there's no unit-test surface for them in this repo. Verified manually in Step 2.

- [ ] **Step 1: Create the 7 loading files**

```tsx
// app/(app)/accounts/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="space-y-10">
        <div className="flex justify-end">
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
        {[0, 1].map((section) => (
          <div key={section} className="space-y-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-36 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// app/(app)/accounts/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="skeleton size-11 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
        </div>
        <div className="skeleton h-8 w-40 rounded-lg" />
      </div>
      <div className="skeleton h-36 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}
```

```tsx
// app/(app)/subscriptions/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="skeleton h-20 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

```tsx
// app/(app)/budgets/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="skeleton h-24 rounded-xl" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

```tsx
// app/(app)/insights/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="skeleton size-8 rounded-md" />
        <div className="skeleton h-6 w-32 rounded" />
        <div className="skeleton size-8 rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
```

```tsx
// app/(app)/transactions/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="skeleton h-8 min-w-40 flex-1 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-8 w-40 rounded-lg" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((day) => (
          <div key={day} className="space-y-2">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// app/(app)/settings/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="skeleton h-96 rounded-xl" />
      <div className="skeleton h-20 rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify navigation shows each skeleton**

Run: `npm run dev`

Throttle the network in devtools (Slow 4G or similar, so the skeleton is visible) and click through: `/accounts` → an account → back to `/accounts` (browser back button), then `/subscriptions`, `/budgets`, `/insights`, `/transactions`, `/settings` from the nav. Confirm each shows its own skeleton mid-navigation instead of a frozen screen, and that the previously-blank accounts↔account-detail transition (including the back button) now shows a skeleton too.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/accounts/loading.tsx" "app/(app)/accounts/[id]/loading.tsx" \
  "app/(app)/subscriptions/loading.tsx" "app/(app)/budgets/loading.tsx" \
  "app/(app)/insights/loading.tsx" "app/(app)/transactions/loading.tsx" \
  "app/(app)/settings/loading.tsx"
git commit -m "$(cat <<'EOF'
feat(ui): add per-route loading skeletons

Only app/(app)/loading.tsx existed, which is too far up the tree to fire
on sibling navigation within the group (e.g. /accounts -> /accounts/[id]
and back) — that's the frozen feeling on account navigation. Each route
now has its own loading.tsx shaped to its real layout, reusing the
existing .skeleton CSS convention.
EOF
)"
```

---

### Task 5: Lazy-load the recharts-based chart components

**Files:**
- Create: `components/accounts/balance-chart-lazy.tsx`
- Create: `components/insights/lazy-charts.tsx`
- Modify: `app/(app)/accounts/[id]/page.tsx:14`
- Modify: `app/(app)/insights/page.tsx:9-13`

**Interfaces:**
- Consumes: `BalanceChart` from `components/accounts/balance-chart.tsx` (unchanged), `SpendDonut`/`CashflowChart`/`SpendingPace` from their existing files (unchanged).
- Produces: `BalanceChart` (default-typed the same as the real component) from `components/accounts/balance-chart-lazy.tsx`; `SpendDonut`, `CashflowChart`, `SpendingPace` from `components/insights/lazy-charts.tsx` — both pages import from these new files instead of the original component files.

`next/dynamic` with `ssr: false` cannot be called directly inside a Server Component (`accounts/[id]/page.tsx` and `insights/page.tsx` are both `async function ... Page()` Server Components) — Next.js throws `ssr: false is not allowed with next/dynamic in Server Components`. Each lazy wrapper is its own small `"use client"` file so the dynamic-import-with-no-SSR logic lives in a Client Component; the Server Component page just does a normal static import of that wrapper.

No automated test — verified via production build in Step 2 (same precedent as the PWA plan's icon-route task: no image/bundle-diffing infra in this repo).

- [ ] **Step 1: Create the two lazy wrapper files**

```tsx
// components/accounts/balance-chart-lazy.tsx
"use client";

import dynamic from "next/dynamic";

export const BalanceChart = dynamic(
  () => import("./balance-chart").then((m) => m.BalanceChart),
  {
    ssr: false,
    loading: () => <div className="skeleton h-56 rounded-xl" />,
  },
);
```

```tsx
// components/insights/lazy-charts.tsx
"use client";

import dynamic from "next/dynamic";

export const SpendDonut = dynamic(
  () => import("./spend-donut").then((m) => m.SpendDonut),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-center">
        <div className="skeleton h-56 rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-5 rounded" />
          ))}
        </div>
      </div>
    ),
  },
);

export const CashflowChart = dynamic(
  () => import("./cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);

export const SpendingPace = dynamic(
  () => import("./spending-pace").then((m) => m.SpendingPace),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);
```

Update `app/(app)/accounts/[id]/page.tsx:14` — change:

```ts
import { BalanceChart } from "@/components/accounts/balance-chart";
```

to:

```ts
import { BalanceChart } from "@/components/accounts/balance-chart-lazy";
```

Update `app/(app)/insights/page.tsx:9-13` — change:

```ts
import { SpendDonut } from "@/components/insights/spend-donut";
import { CashflowChart } from "@/components/insights/cashflow-chart";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { SpendingPace } from "@/components/insights/spending-pace";
```

to:

```ts
import { SpendDonut, CashflowChart, SpendingPace } from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
```

(`BudgetBars` and `DebtHealth` don't use recharts — confirmed via `grep -rl recharts components` — so they stay as direct imports.)

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`

Expected: build succeeds with no "ssr: false is not allowed" error.

Then run `npm run dev`, open an account detail page (a non-card, non-loan account, to hit the `BalanceChart` branch) and `/insights`, and confirm each chart still renders correctly (values, tooltips) after a brief skeleton flash on a throttled connection.

- [ ] **Step 3: Commit**

```bash
git add "components/accounts/balance-chart-lazy.tsx" "components/insights/lazy-charts.tsx" \
  "app/(app)/accounts/[id]/page.tsx" "app/(app)/insights/page.tsx"
git commit -m "$(cat <<'EOF'
perf(ui): lazy-load recharts-based chart components

BalanceChart, SpendDonut, CashflowChart, and SpendingPace are the
heaviest client bundles in the app and loaded eagerly with their page.
Wrapped each in a client-only next/dynamic(..., { ssr: false }) so
recharts' JS no longer blocks first paint of /accounts/[id] or /insights.
EOF
)"
```

---

### Task 6: Add an `isLoading` prop to the shared Button

**Files:**
- Modify: `components/ui/button.tsx`

**Interfaces:**
- Produces: `Button` now accepts an optional `isLoading?: boolean` prop. When `true`: forces `disabled`, sets `aria-busy`, and renders a `Loader2Icon` (spinning) ahead of `children`. Consumed by every task from Task 7 onward.

No automated test — no component-test infra in this repo (same precedent as Task 3/5). Verified via type-check/build in Step 2.

- [ ] **Step 1: Update the Button component**

In `components/ui/button.tsx`, change:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
```

to:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
```

Change:

```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

to:

```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { isLoading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  )
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build`

Expected: build succeeds. (Every existing `<Button>` call site still works unchanged — `isLoading` defaults to `false`, and `children`/`disabled` are now explicit props instead of flowing through the `...props` spread, with identical runtime behavior when `isLoading` is omitted.)

- [ ] **Step 3: Commit**

```bash
git add "components/ui/button.tsx"
git commit -m "$(cat <<'EOF'
feat(ui): add isLoading prop to the shared Button

No isLoading/spinner convention existed — every async button just went
disabled, sometimes with a text swap. isLoading forces disabled + aria-busy
and prepends a spinning Loader2Icon ahead of children, giving Task 7+ a
single place to add real loading feedback across the app.
EOF
)"
```

---

### Task 7: Roll out `isLoading` — statements panel

**Files:**
- Modify: `components/accounts/statements-panel.tsx`

**Interfaces:**
- Consumes: `Button`'s `isLoading` prop from Task 6.

No automated test — same precedent as Task 3 (this file). Verified via build + manual check in Step 2.

- [ ] **Step 1: Add `isLoading={pending}` to the six async buttons**

Change the Import button:

```tsx
        <Button variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 size-4" />
          {t("importButton")}
        </Button>
```

to:

```tsx
        <Button variant="outline" disabled={pending} isLoading={pending} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 size-4" />
          {t("importButton")}
        </Button>
```

Change the password-retry button:

```tsx
            <Button variant="outline" disabled={pending || !password} onClick={() => onParse(file)}>
              {t("retryButton")}
            </Button>
```

to:

```tsx
            <Button variant="outline" disabled={pending || !password} isLoading={pending} onClick={() => onParse(file)}>
              {t("retryButton")}
            </Button>
```

Change the Confirm button:

```tsx
            <Button disabled={pending || !allMapped} onClick={onConfirm}>
              {t("confirmButton")}
            </Button>
```

to:

```tsx
            <Button disabled={pending || !allMapped} isLoading={pending} onClick={onConfirm}>
              {t("confirmButton")}
            </Button>
```

Change the expand-lines icon button (icon-only — omit the chevron while loading instead of branching in `Button`):

```tsx
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={expanded === s.id ? t("hideLinesAria") : t("viewLinesAria")}
                    onClick={() => onToggleLines(s.id)}
                  >
                    {expanded === s.id ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
```

to:

```tsx
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    isLoading={pending}
                    aria-label={expanded === s.id ? t("hideLinesAria") : t("viewLinesAria")}
                    onClick={() => onToggleLines(s.id)}
                  >
                    {pending ? null : expanded === s.id ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
```

Change the delete icon button (icon-only):

```tsx
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => setDeleteTarget(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
```

to:

```tsx
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    isLoading={pending}
                    onClick={() => setDeleteTarget(s.id)}
                  >
                    {pending ? null : <Trash2 className="size-4" />}
                  </Button>
```

Change the destructive delete-confirm button:

```tsx
            <Button
              variant="destructive"
              onClick={() => deleteTarget && onDelete(deleteTarget)}
              disabled={pending}
            >
              {tc("delete")}
            </Button>
```

to:

```tsx
            <Button
              variant="destructive"
              onClick={() => deleteTarget && onDelete(deleteTarget)}
              disabled={pending}
              isLoading={pending}
            >
              {tc("delete")}
            </Button>
```

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`

Then `npm run dev`, open an account with statements, and confirm: clicking Import shows a spinner while parsing; opening the mapping preview and clicking the Confirm button shows a spinner during the (now much faster) save; expanding a statement's lines and deleting a statement each briefly show a spinner on their icon buttons.

- [ ] **Step 3: Commit**

```bash
git add "components/accounts/statements-panel.tsx"
git commit -m "feat(ui): add loading spinners to statements panel buttons"
```

---

### Task 8: Roll out `isLoading` — account & transaction buttons

**Files:**
- Modify: `components/accounts/account-detail-actions.tsx`
- Modify: `components/accounts/account-form-dialog.tsx`
- Modify: `components/transactions/transaction-row.tsx`
- Modify: `components/transactions/transaction-form.tsx`

**Interfaces:**
- Consumes: `Button`'s `isLoading` prop from Task 6.

No automated test — same precedent as prior UI tasks. Verified via build + manual check in Step 2.

- [ ] **Step 1: `account-detail-actions.tsx` — archive/restore and destructive delete**

Change:

```tsx
      <Button variant="ghost" size="sm" onClick={onArchive} disabled={pending}>
        {account.is_archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {account.is_archived ? t("restore") : t("archive")}
      </Button>
```

to:

```tsx
      <Button variant="ghost" size="sm" onClick={onArchive} disabled={pending} isLoading={pending}>
        {account.is_archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {account.is_archived ? t("restore") : t("archive")}
      </Button>
```

Change:

```tsx
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? t("deleting") : tc("delete")}
            </Button>
```

to:

```tsx
            <Button variant="destructive" onClick={onDelete} disabled={pending} isLoading={pending}>
              {pending ? t("deleting") : tc("delete")}
            </Button>
```

- [ ] **Step 2: `account-form-dialog.tsx` — submit**

Change:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addAccountButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
```

to:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addAccountButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
```

- [ ] **Step 3: `transaction-row.tsx` — delete icon button**

Change:

```tsx
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("deleteAria")}
          className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
          onClick={() => onDelete(txn.id)}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </Button>
```

to:

```tsx
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("deleteAria")}
          className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
          onClick={() => onDelete(txn.id)}
          disabled={pending}
          isLoading={pending}
        >
          {pending ? null : <Trash2 className="size-4" />}
        </Button>
```

- [ ] **Step 4: `transaction-form.tsx` — submit**

Change:

```tsx
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? tc("saving") : isEdit ? t("saveChangesButton") : t("saveButton")}
      </Button>
```

to:

```tsx
      <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
        {pending ? tc("saving") : isEdit ? t("saveChangesButton") : t("saveButton")}
      </Button>
```

- [ ] **Step 5: Build and manually verify**

Run: `npm run build`

Then `npm run dev`: archive/restore an account, delete an account, edit an account, delete a transaction, and add/edit a transaction — confirm each shows a spinner while its action is in flight.

- [ ] **Step 6: Commit**

```bash
git add "components/accounts/account-detail-actions.tsx" "components/accounts/account-form-dialog.tsx" \
  "components/transactions/transaction-row.tsx" "components/transactions/transaction-form.tsx"
git commit -m "feat(ui): add loading spinners to account and transaction buttons"
```

---

### Task 9: Roll out `isLoading` — subscriptions buttons

**Files:**
- Modify: `components/subscriptions/subscriptions-view.tsx`
- Modify: `components/subscriptions/subscription-form-dialog.tsx`

**Interfaces:**
- Consumes: `Button`'s `isLoading` prop from Task 6.

No automated test. Verified via build + manual check in Step 2.

- [ ] **Step 1: `subscriptions-view.tsx` — grid view's add-charge and delete**

Change:

```tsx
                <Button size="sm" onClick={() => onAddCharge(sub.id)} disabled={pending}>
                  <Receipt className="size-4" />
                  {t("addCharge")}
                </Button>
```

to:

```tsx
                <Button size="sm" onClick={() => onAddCharge(sub.id)} disabled={pending} isLoading={pending}>
                  <Receipt className="size-4" />
                  {t("addCharge")}
                </Button>
```

Change:

```tsx
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteAria")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(sub.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
```

to:

```tsx
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteAria")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(sub.id)}
                  disabled={pending}
                  isLoading={pending}
                >
                  {pending ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
```

Change the table view's add-charge:

```tsx
                      <Button size="sm" variant="outline" onClick={() => onAddCharge(sub.id)} disabled={pending}>
                        {t("chargeShort")}
                      </Button>
```

to:

```tsx
                      <Button size="sm" variant="outline" onClick={() => onAddCharge(sub.id)} disabled={pending} isLoading={pending}>
                        {t("chargeShort")}
                      </Button>
```

Change the table view's delete:

```tsx
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("deleteAria")}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(sub.id)}
                        disabled={pending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
```

to:

```tsx
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("deleteAria")}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(sub.id)}
                        disabled={pending}
                        isLoading={pending}
                      >
                        {pending ? null : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
```

- [ ] **Step 2: `subscription-form-dialog.tsx` — submit**

Change:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
```

to:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
```

- [ ] **Step 3: Build and manually verify**

Run: `npm run build`

Then `npm run dev`: on `/subscriptions`, log a charge and delete a subscription in both grid and table view, and add/edit a subscription — confirm spinners appear.

- [ ] **Step 4: Commit**

```bash
git add "components/subscriptions/subscriptions-view.tsx" "components/subscriptions/subscription-form-dialog.tsx"
git commit -m "feat(ui): add loading spinners to subscriptions buttons"
```

---

### Task 10: Roll out `isLoading` — budgets buttons

**Files:**
- Modify: `components/budgets/budget-grid.tsx`
- Modify: `components/budgets/category-dialog.tsx`

**Interfaces:**
- Consumes: `Button`'s `isLoading` prop from Task 6.

No automated test. Verified via build + manual check in Step 2.

- [ ] **Step 1: `budget-grid.tsx` — copy-last-month and delete-category**

Change:

```tsx
        <Button variant="outline" size="sm" onClick={onCopy} disabled={pending}>
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
```

to:

```tsx
        <Button variant="outline" size="sm" onClick={onCopy} disabled={pending} isLoading={pending}>
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
```

Change:

```tsx
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("deleteAria", { name: row.name })}
                    className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
                    onClick={() => onDelete(row.category_id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
```

to:

```tsx
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("deleteAria", { name: row.name })}
                    className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
                    onClick={() => onDelete(row.category_id)}
                    disabled={pending}
                    isLoading={pending}
                  >
                    {pending ? null : <Trash2 className="size-4" />}
                  </Button>
```

- [ ] **Step 2: `category-dialog.tsx` — submit**

Change:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
```

to:

```tsx
          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
```

- [ ] **Step 3: Build and manually verify**

Run: `npm run build`

Then `npm run dev`: on `/budgets`, use "Copy last month", delete a category, and add/edit a category — confirm spinners appear.

- [ ] **Step 4: Commit**

```bash
git add "components/budgets/budget-grid.tsx" "components/budgets/category-dialog.tsx"
git commit -m "feat(ui): add loading spinners to budgets buttons"
```

---

### Task 11: Roll out `isLoading` — settings, onboarding & auth buttons

**Files:**
- Modify: `components/settings/settings-panel.tsx`
- Modify: `components/onboarding/welcome-flow.tsx`
- Modify: `components/auth/login-form.tsx`
- Modify: `components/language-switcher.tsx`

**Interfaces:**
- Consumes: `Button`'s `isLoading` prop from Task 6.

No automated test. Verified via build + manual check in Step 2.

- [ ] **Step 1: `settings-panel.tsx` — save display name and delete account**

Change:

```tsx
            <Button
              type="submit"
              size="sm"
              disabled={!nameDirty || namePending}
              className={cn(
                "transition-all duration-200",
                nameDirty
                  ? "scale-100 opacity-100"
                  : "pointer-events-none w-0 scale-90 overflow-hidden px-0 opacity-0",
              )}
            >
              <Check className="size-4" />
              {t("saveButton")}
            </Button>
```

to:

```tsx
            <Button
              type="submit"
              size="sm"
              disabled={!nameDirty || namePending}
              isLoading={namePending}
              className={cn(
                "transition-all duration-200",
                nameDirty
                  ? "scale-100 opacity-100"
                  : "pointer-events-none w-0 scale-90 overflow-hidden px-0 opacity-0",
              )}
            >
              <Check className="size-4" />
              {t("saveButton")}
            </Button>
```

Change:

```tsx
                <Button variant="destructive" onClick={onDeleteAccount} disabled={deletePending}>
                  {deletePending ? t("deleting") : t("deleteAccountButton")}
                </Button>
```

to:

```tsx
                <Button variant="destructive" onClick={onDeleteAccount} disabled={deletePending} isLoading={deletePending}>
                  {deletePending ? t("deleting") : t("deleteAccountButton")}
                </Button>
```

- [ ] **Step 2: `welcome-flow.tsx` — continue/finish**

Change:

```tsx
        <Button onClick={next} disabled={!canAdvance || pending}>
          {step === STEP_COUNT - 1 ? (
```

to:

```tsx
        <Button onClick={next} disabled={!canAdvance || pending} isLoading={pending}>
          {step === STEP_COUNT - 1 ? (
```

- [ ] **Step 3: `login-form.tsx` — Google sign-in and submit**

Change:

```tsx
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onGoogleClick}
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </Button>
```

to:

```tsx
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        isLoading={pending}
        onClick={onGoogleClick}
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </Button>
```

Change:

```tsx
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("pleaseWait") : signingUp ? t("createAccount") : t("signIn")}
        </Button>
```

to:

```tsx
        <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
          {pending ? t("pleaseWait") : signingUp ? t("createAccount") : t("signIn")}
        </Button>
```

- [ ] **Step 4: `language-switcher.tsx` — icon-only dropdown trigger**

Change:

```tsx
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("language")}
            disabled={pending}
          />
        }
      >
        <Languages className="h-5 w-5" />
      </DropdownMenuTrigger>
```

to:

```tsx
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("language")}
            isLoading={pending}
          />
        }
      >
        {pending ? null : <Languages className="h-5 w-5" />}
      </DropdownMenuTrigger>
```

- [ ] **Step 5: Build and manually verify**

Run: `npm run build`

Then `npm run dev`: save a display-name change and delete-account confirm in Settings, step through onboarding as a fresh user, sign in/sign up (including "Continue with Google"), and switch language from the nav — confirm spinners appear on each.

- [ ] **Step 6: Commit**

```bash
git add "components/settings/settings-panel.tsx" "components/onboarding/welcome-flow.tsx" \
  "components/auth/login-form.tsx" "components/language-switcher.tsx"
git commit -m "feat(ui): add loading spinners to settings, onboarding, and auth buttons"
```

---

### Task 12: Final verification sweep

**Files:** none (verification only)

**Interfaces:** none — this task re-runs everything from Tasks 1–11 together as a final gate.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass, including `app/(app)/accounts/statement-actions.test.ts` from Task 1/2 and every existing `lib/statements/*.test.ts`.

- [ ] **Step 2: Full production build**

Run: `npm run build`

Expected: build succeeds with no type errors and no `next/dynamic` server-component warnings.

- [ ] **Step 3: Manual end-to-end pass**

Run: `npm run dev`, then walk the full spec's Testing checklist (design spec §6):

1. Import a real statement end-to-end; confirm the Import (confirm) step is now fast — no second Gemini round-trip.
2. Navigate `/accounts` ↔ an account detail page, including the browser back button, and confirm a skeleton shows instead of a frozen screen.
3. Navigate to `/subscriptions`, `/budgets`, `/insights`, `/transactions`, `/settings` and confirm each shows its own skeleton.
4. On `/accounts/[id]` (non-card account) and `/insights`, confirm charts still render correctly after lazy-loading.
5. Trigger at least one button from each of Tasks 7–11 (statements, accounts, transactions, subscriptions, budgets, settings, onboarding, auth, language switcher) and confirm each shows a spinner instead of just going inert.

No commit for this task — it's a verification gate, not a code change.
