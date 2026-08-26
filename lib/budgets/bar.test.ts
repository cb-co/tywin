import { describe, it, expect } from "vitest";
import { barPct } from "./bar";

describe("barPct", () => {
  it("is the fraction of the budget used", () => {
    expect(barPct(250, 500)).toBe(50);
  });

  it("clamps to the track rather than overflowing it", () => {
    expect(barPct(900, 500)).toBe(100);
  });

  it("never goes negative, so a refund cannot draw backwards", () => {
    expect(barPct(-40, 500)).toBe(0);
  });

  // Spending against no budget is not 0% of anything. An empty bar would read
  // as "nothing spent here", which is the opposite of what happened.
  it("fills completely for spend against no budget", () => {
    expect(barPct(120, 0)).toBe(100);
  });

  it("is empty when there is neither budget nor spend", () => {
    expect(barPct(0, 0)).toBe(0);
  });
});
