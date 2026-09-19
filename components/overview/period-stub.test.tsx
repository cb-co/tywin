import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { FigureMaskProvider } from "@/components/figure-mask/figure-mask-provider";
import { PeriodStub } from "./period-stub";

const html = (used: number, budget: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <FigureMaskProvider>
        <PeriodStub income={3120} spending={2040} used={used} budget={budget} currency="DOP" />
      </FigureMaskProvider>
    </NextIntlClientProvider>,
  );

describe("PeriodStub", () => {
  it("prints three ruled figures and a rule meter, not cards", () => {
    const out = html(500, 1000);
    expect(out).toContain("Income this period");
    expect(out).toContain("Paid out this period");
    expect(out).toContain("Budget used");
    expect(out).toContain('role="meter"');
    expect(out).not.toContain('data-slot="card-header"');
  });
  it("prints the perforation as a dashed rule", () => {
    expect(html(500, 1000)).toContain("border-dashed");
  });
  it("never nests a block element inside a paragraph", () => {
    expect(html(500, 1000)).not.toMatch(/<p[ >](?:(?!<\/p>)[\s\S])*<div/);
  });
  it("flags an overspent budget with a glyph, not only colour", () => {
    expect(html(1200, 1000)).toContain("text-(--red)");
  });
  it("shows a dash and no flag when there is no budget", () => {
    const out = html(0, 0);
    expect(out).toContain("—");
    expect(out).not.toContain("text-(--red)");
  });
  it("prints the true percent and a worded flag when over budget", () => {
    const out = html(1600, 1000);
    expect(out).toContain("160%");
    expect(out).toContain("160% of budget, over");
    expect(out).not.toContain("100.0%");
  });
  it("gives the meter an over-budget reading", () => {
    expect(html(1600, 1000)).toMatch(/aria-valuetext="[^"]*Over budget/);
  });
  it("opens the stub with the period caption under the perforation", () => {
    const out = html(500, 1000);
    expect(out).toContain("This period");
    expect(out.indexOf("border-dashed")).toBeLessThan(out.indexOf("This period"));
    expect(out).not.toContain("of budget, over");
  });
});
