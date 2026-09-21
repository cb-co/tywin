import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LedgerBlock } from "./ledger-block";

describe("LedgerBlock", () => {
  it("prints the head before the body", () => {
    const html = renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>}><p>BODY</p></LedgerBlock>);
    expect(html.indexOf("HEAD")).toBeLessThan(html.indexOf("BODY"));
  });
  it("draws no body wrapper when there are no children", () => {
    expect(renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>} />)).not.toContain("px-4 pb-3");
  });
  it("strips the head row's own rule so the block owns the separator", () => {
    expect(renderToStaticMarkup(<LedgerBlock head={<div>HEAD</div>} />)).toContain("[&amp;&gt;:first-child]:border-b-0");
  });
});
