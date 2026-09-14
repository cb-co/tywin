import { beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (k: string) => headerStore.get(k.toLowerCase()) ?? null })),
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ kind: "cookie" })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ kind: "token" })) }));

import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { createClient } from "./server";

beforeEach(() => {
  headerStore.clear();
  vi.mocked(createServerClient).mockClear();
  vi.mocked(createTokenClient).mockClear();
});

describe("createClient", () => {
  it("uses the cookie session when there is no bearer token", async () => {
    const client = await createClient();
    expect(client).toEqual({ kind: "cookie" });
    expect(createTokenClient).not.toHaveBeenCalled();
  });

  it("uses the bearer token when one is sent, and never persists or refreshes it", async () => {
    headerStore.set("authorization", "Bearer jwt-123");
    const client = await createClient();
    expect(client).toEqual({ kind: "token" });
    expect(createServerClient).not.toHaveBeenCalled();
    const options = vi.mocked(createTokenClient).mock.calls[0][2];
    expect(options?.global?.headers).toEqual({ Authorization: "Bearer jwt-123" });
    expect(options?.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  it("falls back to cookies for a malformed Authorization header", async () => {
    headerStore.set("authorization", "Basic dXNlcjpwYXNz");
    await expect(createClient()).resolves.toEqual({ kind: "cookie" });
  });
});
