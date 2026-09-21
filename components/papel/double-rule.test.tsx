import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DoubleRule } from "./double-rule";

describe("DoubleRule", () => {
  it("is a decorative hr drawn as two ink rules", () => {
    const html = renderToStaticMarkup(<DoubleRule />);
    expect(html).toContain("<hr");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("border-y");
  });
});
