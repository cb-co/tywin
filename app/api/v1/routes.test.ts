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
