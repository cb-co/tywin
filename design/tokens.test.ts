import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import tokens from "./tokens.json";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const block = (marker: string) => {
  const at = CSS.indexOf(marker);
  expect(at, marker).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
};
const ROOT = block("\n:root {");
const DARK = block("\n.dark {");
const value = (b: string, name: string) =>
  b.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]?.toLowerCase();

describe("design/tokens.json ↔ app/globals.css", () => {
  it("declares every fixed token in :root and never overrides it in .dark", () => {
    for (const [name, hex] of Object.entries(tokens.fixed)) {
      expect(value(ROOT, name), `:root --${name}`).toBe(hex);
      expect(value(DARK, name), `.dark must not set --${name}`).toBeUndefined();
    }
  });
  it("matches the light theme", () => {
    for (const [name, hex] of Object.entries(tokens.light)) expect(value(ROOT, name), name).toBe(hex);
  });
  it("matches the dark theme", () => {
    for (const [name, hex] of Object.entries(tokens.dark)) expect(value(DARK, name), name).toBe(hex);
  });
});
