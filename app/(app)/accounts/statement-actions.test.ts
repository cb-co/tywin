import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/statements/extract", () => ({ extractStatementText: vi.fn() }));
vi.mock("@/lib/statements/llm/extract", () => ({
  extractWithLLM: vi.fn(),
  toParsedStatement: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// Only the network call is stubbed; baseRate and friends are pure and stay real.
vi.mock("@/lib/fx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fx")>()),
  getExchangeRates: vi.fn(async () => ({})),
}));
// `unstable_cache` has to be here even though nothing in this file caches:
// lib/fx.ts calls it at module scope, so leaving it off the mock made the whole
// FILE fail to collect — which reads as one failing file rather than a failing
// test and is easy to miss in a summary line. The stub returns the function
// unchanged; fx's only network call is mocked separately just above.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { extractStatementText } from "@/lib/statements/extract";
import { extractWithLLM } from "@/lib/statements/llm/extract";
import { createClient } from "@/lib/supabase/server";
import { confirmStatementImport, parseStatement } from "./statement-actions";
import { MAX_STATEMENT_BYTES } from "@/lib/statements/limits";
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

/** `accountOverrides` lets a test put the account row in a different state
 *  (e.g. already-populated backfill columns) while every other table keeps
 *  the shared stub — narrower than swapping out `stub.from` wholesale, which
 *  silently breaks unrelated tables like `categories` and short-circuits the
 *  function before the code under test ever runs. */
function makeSupabaseStub(
  accountOverrides: Partial<{
    credit_limit: number | null;
    statement_closing_day: number | null;
    payment_due_day: number | null;
  }> = {},
) {
  const account = {
    id: "acc-1",
    name: "Test Card",
    currency: "DOP",
    credit_limit: null,
    statement_closing_day: null,
    payment_due_day: null,
    card_group_id: null,
    type: "credit_card",
    ...accountOverrides,
  };
  const accountUpdate = vi.fn(() => chainable({ error: null }));
  const byTable: Record<string, () => unknown> = {
    accounts: () => chainable({ data: account }, { update: accountUpdate }),
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
    accountUpdate,
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
      cashbackCents: 32800,
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

  it("sends the section's cashback to the import RPC as a decimal string", async () => {
    const supabase = makeSupabaseStub();
    (createClient as unknown as Mock).mockResolvedValue(supabase);
    await confirmStatementImport(buildConfirmFormData());
    const [fn, args] = supabase.rpc.mock.calls[0] as unknown as [string, { p: { sections: unknown[] } }];
    expect(fn).toBe("import_card_statement");
    expect(args.p.sections[0]).toMatchObject({ cashback_total: "328.00" });
  });

  it("sends an empty string when the statement reported no cashback", async () => {
    // "" and not "0.00": the RPC nullifs it, which is what keeps "never
    // reported" distinct from a statement that printed a zero.
    const supabase = makeSupabaseStub();
    (createClient as unknown as Mock).mockResolvedValue(supabase);
    const fd = buildConfirmFormData();
    fd.set(
      "parsed_statement",
      JSON.stringify({
        ...PARSED,
        sections: [{ ...PARSED.sections[0], cashbackCents: null }],
      }),
    );
    await confirmStatementImport(fd);
    const [, args] = supabase.rpc.mock.calls[0] as unknown as [string, { p: { sections: unknown[] } }];
    expect(args.p.sections[0]).toMatchObject({ cashback_total: "" });
  });

  it("backfills closing day, due day and limit from the statement", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        statement_closing_day: expect.any(Number),
        payment_due_day: expect.any(Number),
      }),
    );
  });

  it("does not touch a card whose columns are already set", async () => {
    const stub = makeSupabaseStub({
      credit_limit: 100000,
      statement_closing_day: 20,
      payment_due_day: 10,
    });
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).not.toHaveBeenCalled();
  });
});

describe("parseStatement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(makeSupabaseStub());
  });

  function buildUploadFormData(size: number) {
    const fd = new FormData();
    fd.set("account_id", "acc-1");
    fd.set("file", new File([new Uint8Array(size)], "statement.pdf", { type: "application/pdf" }));
    return fd;
  }

  it("rejects a file past the size limit without reading it", async () => {
    const result = await parseStatement(buildUploadFormData(MAX_STATEMENT_BYTES + 1));
    expect(result.error).toBe("fileTooLarge");
    // The point of checking here rather than downstream: the bytes never reach
    // pdfjs, and no failed-import row is written for something never attempted.
    expect(extractStatementText).not.toHaveBeenCalled();
  });

  it("lets a file at the limit through to extraction", async () => {
    (extractStatementText as unknown as Mock).mockResolvedValue({ ok: false, reason: "unreadable" });
    const result = await parseStatement(buildUploadFormData(MAX_STATEMENT_BYTES));
    expect(extractStatementText).toHaveBeenCalled();
    expect(result.error).toBe("unreadablePdf");
  });
});
