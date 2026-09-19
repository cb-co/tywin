import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Note } from "./note";

const html = (tone: "violet" | "peso") =>
  renderToStaticMarkup(
    <Note tone={tone} label="Available">
      <span className="figure">1<span className="opacity-60">.00</span></span>
    </Note>,
  );

describe("Note", () => {
  it("lifts the cents opacity on the peso note so they clear 4.5:1", () => {
    expect(html("peso")).toContain("[&amp;_.figure&gt;span]:opacity-90");
  });
  it("leaves the violet note's cents alone", () => {
    expect(html("violet")).not.toContain("opacity-90");
  });
});
