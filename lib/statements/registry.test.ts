import { describe, expect, it } from "vitest";
import { detectParser } from "./registry";
import { POPULAR_FIXTURE } from "./fixtures/popular-visa";
import { SCOTIA_FIXTURE } from "./fixtures/scotia-amex";

describe("detectParser", () => {
  it("routes each fixture to its parser", () => {
    expect(detectParser(POPULAR_FIXTURE)?.id).toBe("popular_visa");
    expect(detectParser(SCOTIA_FIXTURE)?.id).toBe("scotia_amex");
  });
  it("returns null for unknown layouts", () => {
    expect(detectParser("ACME BANK STATEMENT 2026")).toBeNull();
  });
});
