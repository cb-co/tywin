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
