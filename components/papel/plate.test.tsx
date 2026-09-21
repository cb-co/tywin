import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Plate } from "./plate";

describe("Plate", () => {
  it("prints the figure number, title and basis in the caption", () => {
    const html = renderToStaticMarkup(
      <Plate figLabel="Fig. 3" title="Spending pace" basis="when charged">
        <p>body</p>
      </Plate>,
    );
    expect(html).toContain("Fig. 3");
    expect(html).toContain("Spending pace");
    expect(html).toContain("when charged");
    expect(html).toContain("<p>body</p>");
  });
  it("omits the basis when none is given", () => {
    const html = renderToStaticMarkup(<Plate figLabel="Fig. 1" title="Net worth"><i /></Plate>);
    expect(html).not.toContain("shrink-0");
  });
});
