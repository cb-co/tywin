import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/subscriptions/llm/brand-color", () => ({ inferBrandColor: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: <T,>(fn: T) => fn }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { inferBrandColor } from "@/lib/subscriptions/llm/brand-color";
import { createClient } from "@/lib/supabase/server";
import {
  createSubscription,
  resolveSubscriptionColor,
  updateSubscription,
} from "./actions";

const infer = inferBrandColor as unknown as Mock;

const VALID = {
  name: "Netflix",
  amount: 15.99,
  currency: "USD",
  billing_cycle: "monthly" as const,
  is_active: true,
};

type Row = { name?: string; color: string | null };

/**
 * A Supabase stub narrow enough to answer two questions: what the read on
 * `subscriptions` returned, and what payload the write received.
 */
function stub(read: { data?: Row | null; error?: unknown } = { data: null }) {
  const writes: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => read);
  chain.single = vi.fn(async () => ({ data: { id: "sub-1" }, error: null }));
  chain.insert = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  chain.update = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ error: null });

  (createClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn(() => chain),
  });
  return writes;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * The save must never wait on the model. Inference answers in ~600ms warm but
 * takes 9-70s cold, so anything on this path is a spinner the person watches.
 */
describe("saving a subscription never calls the model", () => {
  it("does not infer on create", async () => {
    const writes = stub();

    await createSubscription(VALID);

    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toHaveProperty("color");
  });

  it("does not infer on update", async () => {
    const writes = stub({ data: { color: null } });

    await updateSubscription("sub-1", VALID);

    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toHaveProperty("color");
  });
});

/**
 * The gate, now that it lives in the one place that writes the column. It has to
 * hold whether it is reached from a create, an edit, or a backfill of a row that
 * predates the feature — all three arrive here identically.
 */
describe("resolveSubscriptionColor only calls the model when the colour is empty", () => {
  it("infers and stores when the row has no colour", async () => {
    infer.mockResolvedValue("#E50914");
    const writes = stub({ data: { name: "Netflix", color: null } });

    expect(await resolveSubscriptionColor("sub-1")).toEqual({ resolved: true });
    expect(writes).toEqual([{ color: "#E50914" }]);
  });

  // The name comes off the row, not from the caller: this action is reachable
  // with any id, so what it judges should be data RLS already scoped.
  it("judges the stored name rather than anything passed in", async () => {
    infer.mockResolvedValue("#1DB954");
    stub({ data: { name: "Spotify", color: null } });

    await resolveSubscriptionColor("sub-1");

    expect(infer).toHaveBeenCalledWith("Spotify");
  });

  it("does NOT infer when the row already has a colour", async () => {
    const writes = stub({ data: { name: "Netflix", color: "#E50914" } });

    expect(await resolveSubscriptionColor("sub-1")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  // Nothing renders a value the colour maths cannot parse, so treating it as
  // occupied would strand the row forever.
  it("re-infers when the stored value is not a usable hex", async () => {
    infer.mockResolvedValue("#E50914");
    const writes = stub({ data: { name: "Netflix", color: "#FFF" } });

    expect(await resolveSubscriptionColor("sub-1")).toEqual({ resolved: true });
    expect(writes).toEqual([{ color: "#E50914" }]);
  });

  // A failed read tells us nothing about the stored colour. Guessing over it
  // would overwrite a good value we could not see.
  it("does NOT infer when the read failed", async () => {
    const writes = stub({ data: null, error: { message: "boom" } });

    expect(await resolveSubscriptionColor("sub-1")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("does NOT infer when the row is missing", async () => {
    const writes = stub({ data: null });

    expect(await resolveSubscriptionColor("nope")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  // A guess that came back empty — an unplaceable name, or a cold call that ran
  // past its budget — must not write anything at all.
  it("writes nothing when inference returns null", async () => {
    infer.mockResolvedValue(null);
    const writes = stub({ data: { name: "Some Obscure Thing", color: null } });

    expect(await resolveSubscriptionColor("sub-1")).toEqual({ resolved: false });
    expect(writes).toHaveLength(0);
  });
});
