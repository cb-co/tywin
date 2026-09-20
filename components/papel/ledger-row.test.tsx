import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LedgerRow } from "./ledger-row";

describe("LedgerRow trailing slot", () => {
  it("renders trailing content after the amount column", () => {
    const html = renderToStaticMarkup(
      <LedgerRow title="Colmado" amount="RD$ 10" trailing={<button data-x="act">edit</button>} />,
    );
    expect(html.indexOf("RD$ 10")).toBeLessThan(html.indexOf('data-x="act"'));
  });

  it("renders nothing extra without it", () => {
    expect(renderToStaticMarkup(<LedgerRow title="Colmado" />)).not.toContain("data-x");
  });
});
