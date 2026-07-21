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

/** Pins the literal hex values against app/globals.css's --card so a typo'd
 *  constant can't silently drift from the topbar it's meant to match. */
test("matches components/shell/mobile-header.tsx's bg-card in each theme", () => {
  expect(TOPBAR_LIGHT).toBe("#ffffff");
  expect(TOPBAR_DARK).toBe("#161d19");
});
