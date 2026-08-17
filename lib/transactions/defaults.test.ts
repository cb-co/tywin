import { describe, expect, it } from "vitest";
import {
  defaultAccount,
  orderCategories,
  rankCategoryIds,
  recentSourceAccountId,
  type RecentRow,
} from "./defaults";
import type { QuickAddAccount, QuickAddCategory } from "./queries";

function row(over: Partial<RecentRow> = {}): RecentRow {
  return { account_id: "a-checking", category_id: null, type: "expense", ...over };
}

function account(over: Partial<QuickAddAccount> = {}): QuickAddAccount {
  return {
    id: "a-checking",
    name: "Popular",
    currency: "DOP",
    type: "checking",
    network_fee_optional: true,
    bank_id: "bank-popular",
    ...over,
  };
}

function category(id: string): QuickAddCategory {
  return { id, name: id, emoji: null, color: null };
}

describe("rankCategoryIds", () => {
  it("orders by how often a category appears", () => {
    const recent = [
      row({ category_id: "food" }),
      row({ category_id: "transport" }),
      row({ category_id: "food" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["food", "transport"]);
  });

  it("counts expenses only — income has no category and payments default to none", () => {
    const recent = [
      row({ category_id: "transport" }),
      row({ category_id: "food", type: "payment" }),
      row({ category_id: "food", type: "payment" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["transport"]);
  });

  it("ignores uncategorised rows rather than ranking a null", () => {
    expect(rankCategoryIds([row(), row({ category_id: "food" })])).toEqual(["food"]);
  });

  it("returns nothing for an empty history", () => {
    expect(rankCategoryIds([])).toEqual([]);
  });
});

describe("recentSourceAccountId", () => {
  it("takes the source account of the most recent row", () => {
    // The query hands rows back newest-first; this trusts that order rather
    // than re-sorting, so it must not scan for anything but the first hit.
    const recent = [row({ account_id: "a-visa" }), row({ account_id: "a-checking" })];
    expect(recentSourceAccountId(recent)).toBe("a-visa");
  });

  it("skips rows with no source account", () => {
    expect(recentSourceAccountId([row({ account_id: null }), row({ account_id: "a-cash" })])).toBe(
      "a-cash",
    );
  });

  it("returns null for an empty history", () => {
    expect(recentSourceAccountId([])).toBe(null);
  });
});

describe("defaultAccount", () => {
  const accounts = [
    account({ id: "a-visa", type: "credit_card" }),
    account({ id: "a-checking", type: "checking" }),
    account({ id: "a-savings", type: "savings" }),
  ];

  it("prefers an explicitly requested account", () => {
    // The account detail page opens the form scoped to one account.
    expect(defaultAccount(accounts, { preferredId: "a-savings", recentAccountId: "a-visa" })?.id)
      .toBe("a-savings");
  });

  it("falls back to the most recently used account", () => {
    expect(defaultAccount(accounts, { recentAccountId: "a-visa" })?.id).toBe("a-visa");
  });

  it("ignores a remembered account that no longer exists", () => {
    // Archived or deleted since the row was written: the list excludes it.
    expect(defaultAccount(accounts, { recentAccountId: "a-gone" })?.id).toBe("a-checking");
  });

  it("falls back to the first bank account, never to whatever came first", () => {
    // A card or loan is a bad default source for a new expense.
    expect(defaultAccount(accounts, {})?.id).toBe("a-checking");
  });

  it("falls back to the first account when none is a bank account", () => {
    const cards = [account({ id: "a-visa", type: "credit_card" })];
    expect(defaultAccount(cards, {})?.id).toBe("a-visa");
  });

  it("returns undefined when there are no accounts at all", () => {
    expect(defaultAccount([], {})).toBeUndefined();
  });
});

describe("orderCategories", () => {
  const categories = [category("food"), category("transport"), category("home")];

  it("puts ranked categories first, in rank order", () => {
    expect(orderCategories(categories, ["home", "transport"]).map((c) => c.id)).toEqual([
      "home",
      "transport",
      "food",
    ]);
  });

  it("keeps unranked categories in their existing sort_order", () => {
    expect(orderCategories(categories, []).map((c) => c.id)).toEqual([
      "food",
      "transport",
      "home",
    ]);
  });

  it("drops ranked ids that no longer match a category", () => {
    expect(orderCategories(categories, ["deleted", "home"]).map((c) => c.id)).toEqual([
      "home",
      "food",
      "transport",
    ]);
  });
});
