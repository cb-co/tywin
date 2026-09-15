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
