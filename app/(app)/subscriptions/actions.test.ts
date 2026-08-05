import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/subscriptions/llm/brand", () => ({ inferBrand: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: <T,>(fn: T) => fn }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { inferBrand } from "@/lib/subscriptions/llm/brand";
import { createClient } from "@/lib/supabase/server";
import { NO_SIMPLE_ICON } from "@/lib/brand/logo-uri";
import { createSubscription, resolveSubscriptionBrand, updateSubscription } from "./actions";

const infer = inferBrand as unknown as Mock;

/** What the model returns when it recognised the service outright. */
const found = (color: string, logoUri: string) => ({ color, logoUri, answered: true });
/** Answered, but the name is a gym nobody has drawn a logo for. */
const nothing = { color: null, logoUri: null, answered: true };
/** Did not answer at all — timeout, abort, 500. */
const failed = { color: null, logoUri: null, answered: false };

const VALID = {
  name: "Netflix",
  amount: 15.99,
  currency: "USD",
  billing_cycle: "monthly" as const,
  is_active: true,
};

type Row = { name?: string; color?: string | null; logo_url?: string | null };

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
    const writes = stub({ data: { name: "Netflix" } });

    await updateSubscription("sub-1", VALID);

    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toHaveProperty("color");
  });
});

/**
 * A rename invalidates the brand, because the brand was inferred from the name.
 * Without this, "Netflix" edited to "Spotify" keeps Netflix's red and mark.
 */
describe("renaming clears the brand so it resolves again", () => {
  it("clears colour and logo when the name changed", async () => {
    const writes = stub({ data: { name: "Netflix" } });

    await updateSubscription("sub-1", { ...VALID, name: "Spotify" });

    expect(writes[0]).toMatchObject({ name: "Spotify", color: null, logo_url: null });
  });

  it("leaves the brand alone when the name did not change", async () => {
    const writes = stub({ data: { name: "Netflix" } });

    await updateSubscription("sub-1", { ...VALID, amount: 22.99 });

    expect(writes[0]).not.toHaveProperty("color");
    expect(writes[0]).not.toHaveProperty("logo_url");
  });

  // Clearing a brand over a question we could not answer is the worse error.
  it("treats an unreadable row as not renamed", async () => {
    const writes = stub({ data: null });

    await updateSubscription("sub-1", { ...VALID, name: "Spotify" });

    expect(writes[0]).not.toHaveProperty("color");
  });
});

/**
 * The gate, and the reason it reads `logo_url` rather than "do we have a brand".
 * Most subscriptions are a gym or a local ISP that no icon set has ever drawn,
 * so "no brand" is their permanent state — gating on it meant a fresh model call
 * on every edit of those rows, forever, for the same nothing.
 */
describe("resolveSubscriptionBrand runs once per name, not once per save", () => {
  it("infers and stores when the row has never been resolved", async () => {
    infer.mockResolvedValue(found("#E50914", "simple-icons:netflix"));
    const writes = stub({ data: { name: "Netflix", color: null, logo_url: null } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: true });
    expect(writes).toEqual([{ color: "#E50914", logo_url: "simple-icons:netflix" }]);
  });

  // The name comes off the row, not from the caller: this action is reachable
  // with any id, so what it judges should be data RLS already scoped.
  it("judges the stored name rather than anything passed in", async () => {
    infer.mockResolvedValue(found("#1DB954", "simple-icons:spotify"));
    stub({ data: { name: "Spotify", color: null, logo_url: null } });

    await resolveSubscriptionBrand("sub-1");

    expect(infer).toHaveBeenCalledWith("Spotify");
  });

  // THE regression this gate exists for. The model answered, there was no mark,
  // and that has to be recorded or the next save asks again.
  it("records the attempt when the model finds nothing", async () => {
    infer.mockResolvedValue(nothing);
    const writes = stub({ data: { name: "Gimnasio Bella Vista", color: null, logo_url: null } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: false });
    expect(writes).toEqual([{ logo_url: NO_SIMPLE_ICON }]);
  });

  it("does NOT infer again once an attempt is recorded", async () => {
    const writes = stub({
      data: { name: "Gimnasio Bella Vista", color: null, logo_url: NO_SIMPLE_ICON },
    });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("does NOT infer when the row already has a logo", async () => {
    const writes = stub({
      data: { name: "Netflix", color: "#E50914", logo_url: "simple-icons:netflix" },
    });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  // A colour with no logo is every row saved before logos existed. Those heal on
  // their next save rather than needing a migration.
  it("still resolves a row that has a colour but was never looked up", async () => {
    infer.mockResolvedValue(found("#E50914", "simple-icons:netflix"));
    const writes = stub({ data: { name: "Netflix", color: "#111111", logo_url: null } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: true });
    expect(writes).toEqual([{ color: "#E50914", logo_url: "simple-icons:netflix" }]);
  });

  // A logo with no usable colour must not blank the colour already on the row.
  it("writes only the logo when no colour came back", async () => {
    infer.mockResolvedValue({ color: null, logoUri: "simple-icons:notion", answered: true });
    const writes = stub({ data: { name: "Notion", color: "#111111", logo_url: null } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: true });
    expect(writes).toEqual([{ logo_url: "simple-icons:notion" }]);
  });

  /* A call that never answered says nothing about the NAME — only about the
     network that day. Recording it as an attempt would strand the row unbranded
     forever, which is the opposite failure to the one above. */
  it("records nothing when the call failed, so the next save retries", async () => {
    infer.mockResolvedValue(failed);
    const writes = stub({ data: { name: "Netflix", color: null, logo_url: null } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: false });
    expect(writes).toHaveLength(0);
  });

  // A failed read tells us nothing about the stored brand. Guessing over it
  // would overwrite good values we could not see.
  it("does NOT infer when the read failed", async () => {
    const writes = stub({ data: null, error: { message: "boom" } });

    expect(await resolveSubscriptionBrand("sub-1")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("does NOT infer when the row is missing", async () => {
    const writes = stub({ data: null });

    expect(await resolveSubscriptionBrand("nope")).toEqual({ resolved: false });
    expect(infer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});
