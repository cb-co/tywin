import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { FigureMaskProvider } from "@/components/figure-mask/figure-mask-provider";
import { AvailableHero } from "./available-hero";
import type { Available } from "@/lib/overview/available";

const base: Available = {
  periodEnd: "2026-09-30", liquid: 3200, committed: 0, cardsMinimum: 0, cardsFull: 0,
  loans: 0, subscriptions: 0, available: 1840, availableIfCardsCleared: 1840, cardBasis: [], fxUnconverted: [],
};
const html = (available: Partial<Available>) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FigureMaskProvider>
        <AvailableHero
          available={{ ...base, ...available }}
          netWorth={18430}
          currency="DOP"
          period={{ start: "2026-09-16", end: "2026-09-30" }}
          today="2026-09-23"
        />
      </FigureMaskProvider>
    </NextIntlClientProvider>,
  );

describe("AvailableHero", () => {
  it("prints the period serial on the note", () => {
    expect(html({})).toContain("QNA 2026-09 B");
  });
  it("keeps net worth on the note", () => {
    expect(html({})).toContain("Net worth");
  });
  it("prints a negative figure on a white inset with a flag mark, not on the orange", () => {
    const out = html({ available: -250 });
    expect(out).toContain("Committed beyond your balance");
    expect(out).toContain("text-(--red)");
    expect(out).toContain("bg-(--paper-2)");
  });
  it("shows no flag when the figure is positive", () => {
    expect(html({})).not.toContain("Committed beyond your balance");
  });
});
