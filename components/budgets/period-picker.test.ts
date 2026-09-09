import { describe, it, expect } from "vitest";
import { showsPeriodToggle } from "./period-picker";

const MONTH = { start: "2026-09-01", end: "2026-09-30" };

describe("showsPeriodToggle", () => {
  it("hides the toggle for an ordinary monthly profile (null anchor)", () => {
    expect(showsPeriodToggle(MONTH, "monthly", null)).toBe(false);
  });

  it("hides the toggle for a monthly profile anchored on the 1st", () => {
    expect(showsPeriodToggle(MONTH, "monthly", 1)).toBe(false);
  });

  /* The regression this predicate exists to prevent: a monthly profile
     anchored elsewhere (paid on the 25th) has an own-period that straddles
     two calendar months, so "Mes" and their own period genuinely differ —
     hiding the toggle here would trap them on whichever side they land on,
     with no way to the other. `payCycle === "monthly"` alone gets this
     wrong; only isWholeMonth(their own period) gets it right. */
  it("shows the toggle for a monthly profile anchored mid-month", () => {
    expect(showsPeriodToggle(MONTH, "monthly", 25)).toBe(true);
  });

  it("shows the toggle for a semimonthly profile, even while the displayed period is itself a whole month", () => {
    // MONTH here stands in for what "Mes" currently displays after a
    // semimonthly user has toggled onto it — showsPeriodToggle must not read
    // that back as "both sides are the same", or the toggle would vanish out
    // from under them with no way back to their quincena.
    expect(showsPeriodToggle(MONTH, "semimonthly", null)).toBe(true);
  });

  it("shows the toggle for a weekly profile", () => {
    expect(showsPeriodToggle(MONTH, "weekly", 1)).toBe(true);
  });
});
