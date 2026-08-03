import { describe, expect, it } from "vitest";
import { computeFunding, type BalanceRow, type ContributionRow } from "./funding";

let seq = 0;
/** A contribution in base currency (rate 1) unless `base` says otherwise. */
const c = (
  goal: string,
  account: string,
  amount: number,
  date = "2026-07-15",
  base = amount,
): ContributionRow => ({
  id: `c${++seq}`,
  goal_id: goal,
  account_id: account,
  amount,
  base_amount: base,
  occurred_at: `${date}T12:00:00+00:00`,
});

const bal = (account_id: string, balance: number): BalanceRow => ({ account_id, balance });

describe("computeFunding — accounts", () => {
  it("commits what was contributed when the balance covers it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 1000)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 1000, committed: 400, available: 600,
    });
  });

  it("clamps the commitment to the balance when spending has eaten into it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 200)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 200, committed: 200, available: 0,
    });
  });

  it("commits nothing from an account at zero", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 0)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 0, committed: 0, available: 0,
    });
  });

  it("leaves a negative balance untouched rather than committing against it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", -50)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: -50, committed: 0, available: -50,
    });
  });

  it("reports an account with no contributions as fully available", () => {
    const f = computeFunding([], [bal("chk", 750)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 750, committed: 0, available: 750,
    });
  });
});

describe("computeFunding — goals", () => {
  it("backs a goal fully when its account can cover it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 1000)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 400, backed: 400, shortfall: 0 });
  });

  it("reports the uncovered remainder as shortfall", () => {
    const f = computeFunding([c("g1", "chk", 1000)], [bal("chk", 800)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 800, shortfall: 200 });
  });

  it("borrows back from the most recently funded goal first", () => {
    // 600 + 600 committed against 800 held: the newer goal eats the 400 shortfall.
    const f = computeFunding(
      [c("old", "chk", 600, "2026-05-01"), c("new", "chk", 600, "2026-07-01")],
      [bal("chk", 800)],
    );
    expect(f.goals.get("old")).toEqual({ goalId: "old", saved: 600, backed: 600, shortfall: 0 });
    expect(f.goals.get("new")).toEqual({ goalId: "new", saved: 600, backed: 200, shortfall: 400 });
  });

  it("breaks a same-date tie by contribution id so the result is stable", () => {
    const a = c("gA", "chk", 500, "2026-07-01");
    const b = c("gB", "chk", 500, "2026-07-01");
    const forward = computeFunding([a, b], [bal("chk", 500)]);
    const reversed = computeFunding([b, a], [bal("chk", 500)]);
    expect(forward.goals.get("gA")).toEqual(reversed.goals.get("gA"));
    expect(forward.goals.get("gB")).toEqual(reversed.goals.get("gB"));
  });

  it("nets a withdrawal against the goal and frees the account's commitment", () => {
    const f = computeFunding(
      [c("g1", "chk", 500, "2026-06-01"), c("g1", "chk", -200, "2026-07-01")],
      [bal("chk", 1000)],
    );
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 300, backed: 300, shortfall: 0 });
    expect(f.accounts.get("chk")?.committed).toBe(300);
  });

  it("skips a pair that has been fully withdrawn, leaving capacity for others", () => {
    const f = computeFunding(
      [
        c("spent", "chk", 300, "2026-07-02"),
        c("spent", "chk", -300, "2026-07-03"),
        c("kept", "chk", 400, "2026-07-01"),
      ],
      [bal("chk", 400)],
    );
    expect(f.goals.get("kept")).toEqual({ goalId: "kept", saved: 400, backed: 400, shortfall: 0 });
    expect(f.goals.get("spent")).toEqual({ goalId: "spent", saved: 0, backed: 0, shortfall: 0 });
  });

  it("sums a goal funded from two accounts", () => {
    const f = computeFunding(
      [c("g1", "chk", 300), c("g1", "sav", 700)],
      [bal("chk", 1000), bal("sav", 1000)],
    );
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 1000, shortfall: 0 });
  });

  it("applies the shortfall per account, not across them", () => {
    const f = computeFunding(
      [c("g1", "chk", 300), c("g1", "sav", 700)],
      [bal("chk", 100), bal("sav", 1000)],
    );
    // chk backs only 100 of its 300; sav backs all 700.
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 800, shortfall: 200 });
  });

  it("converts the backed portion at the pair's own blended rate", () => {
    // 1000 pesos contributed, worth 500 base. Only half the pesos are held.
    const f = computeFunding([c("g1", "mxn", 1000, "2026-07-01", 500)], [bal("mxn", 500)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 500, backed: 250, shortfall: 250 });
  });

  it("ignores contributions from an account with no balance row", () => {
    // The account_commitments view excludes credit cards and loans, so such a
    // row should never arrive — but it must not corrupt the totals if it does.
    const f = computeFunding([c("g1", "card", 400)], []);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 400, backed: 0, shortfall: 400 });
    expect(f.accounts.has("card")).toBe(false);
  });
});
