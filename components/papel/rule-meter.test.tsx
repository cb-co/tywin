import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleMeter } from "./rule-meter";

describe("RuleMeter near state", () => {
  it("prints a hairline base rule by default", () => {
    const html = renderToStaticMarkup(<RuleMeter used={50} total={100} label="x" />);
    expect(html).not.toContain("border-b-2");
  });
  it("prints a heavy base rule when near", () => {
    expect(renderToStaticMarkup(<RuleMeter used={85} total={100} label="x" near />)).toContain("border-b-2");
  });
  it("over wins over near: no heavy rule, red fill", () => {
    const html = renderToStaticMarkup(<RuleMeter used={120} total={100} label="x" near overLabel="Over" />);
    expect(html).not.toContain("border-b-2");
    expect(html).toContain("bg-(--red)");
  });
});
