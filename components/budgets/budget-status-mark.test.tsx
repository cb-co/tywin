import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetStatusMark } from "./budget-status-mark";

const labels = { overLabel: "Excedido", nearLabel: "Cerca" };

describe("BudgetStatusMark", () => {
  it("prints nothing for a budget that is within", () => {
    expect(renderToStaticMarkup(<BudgetStatusMark status="within" {...labels} />)).toBe("");
  });
  it("prints an engraved tag for a budget that is near, with no proof glyph", () => {
    const html = renderToStaticMarkup(<BudgetStatusMark status="approaching" {...labels} />);
    expect(html).toContain("Cerca");
    expect(html).not.toContain("<svg");
  });
  it("prints a flag proof mark for a budget that is over", () => {
    const html = renderToStaticMarkup(<BudgetStatusMark status="over" {...labels} />);
    expect(html).toContain("Excedido");
    expect(html).toContain("<svg");
  });
});
