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
});
