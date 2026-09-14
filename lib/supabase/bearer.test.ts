import { describe, expect, it } from "vitest";
import { bearerToken } from "./bearer";

describe("bearerToken", () => {
  it("returns the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("is case-insensitive about the scheme", () => {
    expect(bearerToken("bearer abc")).toBe("abc");
  });

  it("returns null when there is no header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
  });

  /* A Basic header, a bare token or an empty Bearer is not a token. Treating any of
     them as one would switch the request off its cookie session for nothing. */
  it("rejects anything that is not exactly one Bearer token", () => {
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("abc.def.ghi")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});
