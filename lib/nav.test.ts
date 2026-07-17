import { expect, test } from "vitest";
import { NAV_ITEMS } from "./nav";

test("nav items have unique, root-absolute hrefs", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  expect(hrefs).toContain("/");
});
