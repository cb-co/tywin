import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Stamp } from "./stamp";
import { stampInk, STAMP_SURFACE } from "@/lib/papel/ink";

const html = (color: string | null) => renderToStaticMarkup(<Stamp color={color} name="Food" />);

describe("Stamp", () => {
  it("computes both theme inks from a valid hex", () => {
    const out = html("#ffffff");
    expect(out).toContain(`--stamp-light:${stampInk("#ffffff", STAMP_SURFACE.light)}`);
    expect(out).toContain(`--stamp-dark:${stampInk("#ffffff", STAMP_SURFACE.dark)}`);
  });
  it("passes a var() colour through to both themes", () => {
    const out = html("var(--brand)");
    expect(out).toContain("--stamp-light:var(--brand)");
    expect(out).toContain("--stamp-dark:var(--brand)");
  });
  it("falls back to soft ink for null or an invalid colour", () => {
    for (const c of [null, "red", "#12"]) expect(html(c)).toContain("--stamp-light:var(--ink-soft)");
  });
});
