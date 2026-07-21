import { expect, test } from "vitest";
import { TOPBAR_DARK } from "../lib/pwa/theme-color";
import manifest from "./manifest";

test("exposes 192, 512, and a maskable 512 icon", () => {
  const result = manifest();
  const sizes = result.icons?.map((icon) => icon.sizes);
  expect(sizes).toEqual(["192x192", "512x512", "512x512"]);
  expect(result.icons?.[2]?.purpose).toBe("maskable");
});

test("launches standalone with the splash background and dark topbar chrome", () => {
  const result = manifest();
  expect(result.display).toBe("standalone");
  expect(result.background_color).toBe("#faf7f0");
  expect(result.theme_color).toBe(TOPBAR_DARK);
});
