import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { QuincenaEdge } from "./quincena-edge";

const html = (today: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QuincenaEdge start="2026-09-16" end="2026-09-30" today={today} />
    </NextIntlClientProvider>,
  );

describe("QuincenaEdge", () => {
  it("reads as one image with the day count and payday", () => {
    const out = html("2026-09-23");
    expect(out).toContain('role="img"');
    expect(out).toMatch(/Day 8 of 15, payday Sep 30/);
  });
  it("places the today marker along the edge", () => {
    expect(html("2026-09-23")).toContain("left:50%");
    expect(html("2026-09-16")).toContain("left:0%");
  });
  const caption = (out: string) => out.match(/<span[^>]*legend absolute[^>]*>/)![0];
  it("left-aligns the caption to the marker at the start of the period", () => {
    const c = caption(html("2026-09-16"));
    expect(c).toContain("left:0%");
    expect(c).not.toContain("-translate-x");
  });
  it("centres the caption on the marker mid-period", () => {
    const c = caption(html("2026-09-23"));
    expect(c).toContain("left:50%");
    expect(c).toContain("-translate-x-1/2");
  });
  it("right-aligns the caption to the marker at payday", () => {
    const c = caption(html("2026-09-30"));
    expect(c).toContain("left:100%");
    expect(c).toContain("-translate-x-full");
    expect(c).toContain("text-right");
  });
  it("clamps a today outside the period to the nearest end", () => {
    const before = caption(html("2026-08-01"));
    expect(before).toContain("left:0%");
    expect(before).not.toContain("-translate-x");
    const after = html("2026-12-31");
    expect(caption(after)).toContain("left:100%");
    expect(caption(after)).toContain("-translate-x-full");
    expect(after).toMatch(/Day 15 of 15/);
  });
  it("keeps the caption above the tick, clear of it", () => {
    const c = caption(html("2026-09-23"));
    expect(c).toContain("top-0");
    expect(c).not.toContain("-top-");
  });
});
