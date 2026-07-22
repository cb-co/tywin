import { describe, expect, it } from "vitest";
import { inferYear, ddmmyyyyToIso, monthBeforePlusDay } from "./dates";

describe("inferYear", () => {
  it("uses the cutoff year for same-or-earlier months", () => {
    expect(inferYear("28/05", "2026-06-25")).toBe("2026-05-28");
    expect(inferYear("25/06", "2026-06-25")).toBe("2026-06-25");
  });
  it("rolls back a year when the month is after the cutoff month", () => {
    expect(inferYear("28/12", "2027-01-10")).toBe("2026-12-28");
  });
});

describe("ddmmyyyyToIso", () => {
  it("parses slash and dash forms", () => {
    expect(ddmmyyyyToIso("25/06/2026")).toBe("2026-06-25");
    expect(ddmmyyyyToIso("15-07-2026")).toBe("2026-07-15");
  });
});

describe("monthBeforePlusDay", () => {
  it("computes the day after the previous cutoff", () => {
    expect(monthBeforePlusDay("2026-06-25")).toBe("2026-05-26");
    expect(monthBeforePlusDay("2027-01-10")).toBe("2026-12-11");
  });
});
