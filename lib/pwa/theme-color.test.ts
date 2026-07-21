import { expect, test } from "vitest";
import { TOPBAR_DARK, TOPBAR_LIGHT, topbarThemeColor } from "./theme-color";

test("returns the light topbar color for the light theme", () => {
  expect(topbarThemeColor("light")).toBe(TOPBAR_LIGHT);
});

test("returns the dark topbar color for the dark theme", () => {
  expect(topbarThemeColor("dark")).toBe(TOPBAR_DARK);
});

test("returns null for an unresolved or unrecognized theme", () => {
  expect(topbarThemeColor(undefined)).toBeNull();
  expect(topbarThemeColor("system")).toBeNull();
});
