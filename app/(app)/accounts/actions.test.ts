import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// `unstable_cache` has to be here even though nothing in this file caches:
// modules this file pulls in call it at module scope, so leaving it off the
// mock made the whole FILE fail to collect — which reads as one failing file
// rather than a failing test and is easy to miss in a summary line.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: <T,>(fn: T) => fn }));
// Real path is lib/accounts/llm/card-art (not lib/accounts/card-art, which only
// holds hasCardAccent/DEFAULT_CARD_ACCENT) — mocking the wrong module would let
// the real inferCardArt run and try to call an LLM during these tests.
vi.mock("@/lib/accounts/llm/card-art", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accounts/llm/card-art")>()),
  inferCardArt: vi.fn(async () => null),
}));

import { createClient } from "@/lib/supabase/server";
import { createCardStub, addCardLine } from "./actions";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

beforeEach(() => vi.clearAllMocks());

describe("createCardStub", () => {
  it("writes a credit card with the three describable columns left null", async () => {
    const insert = vi.fn(() => chainable({ data: { id: "acc-new" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn(() => chainable({ data: null }, { insert })),
    });

    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "4921" });

    expect(r.id).toBe("acc-new");
    const row = (insert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(row.type).toBe("credit_card");
    expect(row.currency).toBe("DOP");
    expect(row.last4).toBe("4921");
    expect(row).not.toHaveProperty("credit_limit");
    expect(row).not.toHaveProperty("statement_closing_day");
    expect(row).not.toHaveProperty("payment_due_day");
    expect(row.card_group_id).toBeUndefined();
  });

  it("rejects a bad last4 before touching the database", async () => {
    const createClientMock = createClient as Mock;
    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "49" });
    expect(r.error).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe("addCardLine", () => {
  it("promotes an ungrouped card into a card group and joins both to it", async () => {
    const accountInsert = vi.fn(() => chainable({ data: { id: "acc-usd" }, error: null }));
    const accountUpdate = vi.fn(() => chainable({ error: null }));
    const groupInsert = vi.fn(() => chainable({ data: { id: "grp-1" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn((table: string) =>
        table === "card_groups"
          ? chainable({ data: null }, { insert: groupInsert })
          : chainable(
              {
                data: {
                  id: "acc-1",
                  name: "Popular Visa",
                  type: "credit_card",
                  card_group_id: null,
                  color: "#123456",
                  brand: "visa",
                },
              },
              { insert: accountInsert, update: accountUpdate },
            ),
      ),
    });

    const r = await addCardLine("acc-1", { name: "Popular Visa USD", currency: "USD" });

    expect(r.id).toBe("acc-usd");
    expect(groupInsert).toHaveBeenCalled();
    expect(accountUpdate).toHaveBeenCalledWith({ card_group_id: "grp-1" });
    expect(((accountInsert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>).card_group_id).toBe("grp-1");
  });

  it("reuses an existing group instead of creating a second one", async () => {
    const accountInsert = vi.fn(() => chainable({ data: { id: "acc-usd" }, error: null }));
    const groupInsert = vi.fn(() => chainable({ data: { id: "grp-new" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn((table: string) =>
        table === "card_groups"
          ? chainable({ data: null }, { insert: groupInsert })
          : chainable(
              {
                data: {
                  id: "acc-1",
                  name: "Popular Visa",
                  type: "credit_card",
                  card_group_id: "grp-existing",
                  color: null,
                  brand: null,
                },
              },
              { insert: accountInsert },
            ),
      ),
    });

    await addCardLine("acc-1", { name: "Cuotas", currency: "DOP" });

    expect(groupInsert).not.toHaveBeenCalled();
    expect(((accountInsert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>).card_group_id).toBe("grp-existing");
  });
});
