import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProofMark } from "./proof-mark";

describe("ProofMark size", () => {
  it("defaults to the small mark", () => {
    expect(renderToStaticMarkup(<ProofMark tone="ok">Cuadra</ProofMark>)).toContain("size-4");
  });
  it("prints a large mark when asked", () => {
    const out = renderToStaticMarkup(<ProofMark tone="ok" size="lg">Listo</ProofMark>);
    expect(out).toContain("size-14");
    expect(out).not.toContain("size-4 ");
  });
});
