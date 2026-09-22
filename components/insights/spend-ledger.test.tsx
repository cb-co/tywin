import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { SpendLedger } from "./spend-ledger";
import { FigureMaskProvider } from "@/components/figure-mask/figure-mask-provider";
import type { Insights } from "@/lib/insights/queries";

const messages = {
  Insights: {
    thisMonth: "This month",
    spendOther: "Everything else",
    spendDonutEmpty: "No spending this month yet.",
    categorySheetEmpty: "No transactions found.",
  },
};

const data: Insights["distribution"] = [
  { name: "Dining", value: 1200, color: "#E85B3F", emoji: "🍜", categoryId: "dining" },
  { name: "Transport", value: 550, color: "#1A96CE", categoryId: "transport" },
];

const html = (rows: Insights["distribution"]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FigureMaskProvider>
        <SpendLedger data={rows} total={1750} currency="DOP" month="2026-09-01" scope={{ kind: "insights" }} />
      </FigureMaskProvider>
    </NextIntlClientProvider>,
  );

describe("SpendLedger", () => {
  it("makes each category row an interactive button", () => {
    const out = html(data);
    expect(out.match(/<button/g)?.length).toBe(2);
  });

  it("also makes the folded 'everything else' row a button — it must be queryable, not skipped", () => {
    // 8 categories -> shareRows folds the tail into one "rest" row, which
    // stands in for every category past the top 7 and must stay tappable so
    // its own transactions (across all of them) can be queried too.
    const many: Insights["distribution"] = Array.from({ length: 8 }, (_, i) => ({
      name: `Cat ${i}`,
      value: 100 - i,
      color: "#E85B3F",
      categoryId: `cat-${i}`,
    }));
    const out = html(many);
    expect(out.match(/<button/g)?.length).toBe(8);
    expect(out).toContain("Everything else");
  });
});
