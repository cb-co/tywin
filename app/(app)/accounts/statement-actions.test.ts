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
