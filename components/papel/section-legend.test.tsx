import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionLegend } from "./section-legend";

describe("SectionLegend", () => {
  it("prints the label as a level-2 heading over a heavy rule", () => {
    const html = renderToStaticMarkup(<SectionLegend>Presupuestos</SectionLegend>);
    expect(html).toContain("<h2");
    expect(html).toContain("Presupuestos");
    expect(html).toContain("border-b-2");
  });
  it("prints the aside after the heading", () => {
    const html = renderToStaticMarkup(<SectionLegend aside={<span>ASIDE</span>}>Label</SectionLegend>);
    expect(html.indexOf("Label")).toBeLessThan(html.indexOf("ASIDE"));
  });
});
