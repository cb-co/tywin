import { describe, it, expect } from "vitest";
import { meterFill } from "./meter";

describe("meterFill", () => {
  it("is a clamped percentage", () => {
    expect(meterFill(25, 100)).toEqual({ pct: 25, over: false });
    expect(meterFill(150, 100)).toEqual({ pct: 100, over: true });
    expect(meterFill(-5, 100)).toEqual({ pct: 0, over: false });
  });
  it("treats a zero budget as empty, not over", () => {
    expect(meterFill(10, 0)).toEqual({ pct: 0, over: false });
  });
});
