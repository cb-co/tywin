import { describe, expect, it } from "vitest";
import { parseMoneyCents, centsToDecimal } from "./money";

describe("parseMoneyCents", () => {
  it("parses plain amounts", () => {
    expect(parseMoneyCents("3,388.00")).toBe(338800);
  });
  it("parses negatives", () => {
    expect(parseMoneyCents("-19,765.46")).toBe(-1976546);
  });
  it("tolerates the Scotia trailing dot and surrounding spaces", () => {
    expect(parseMoneyCents("  1,300.00.  ")).toBe(130000);
    expect(parseMoneyCents("-4,000.00.")).toBe(-400000);
  });
  it("parses amounts without thousands separators", () => {
    expect(parseMoneyCents("62.00")).toBe(6200);
  });
});

describe("centsToDecimal", () => {
  it("renders with two decimals and sign", () => {
    expect(centsToDecimal(338800)).toBe("3388.00");
    expect(centsToDecimal(-1976546)).toBe("-19765.46");
    expect(centsToDecimal(0)).toBe("0.00");
  });
});
