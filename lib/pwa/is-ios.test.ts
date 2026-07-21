import { expect, test } from "vitest";
import { isIosUserAgent } from "./is-ios";

test("detects iPhone and iPad user agents", () => {
  const iphoneUa =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
  const ipadUa =
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
  expect(isIosUserAgent(iphoneUa)).toBe(true);
  expect(isIosUserAgent(ipadUa)).toBe(true);
});

test("does not flag Android or desktop user agents", () => {
  const androidUa =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0";
  const macUa =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
  expect(isIosUserAgent(androidUa)).toBe(false);
  expect(isIosUserAgent(macUa)).toBe(false);
});

test("detects iPadOS 13+ reporting as a touch-capable Mac", () => {
  const ipadOs13PlusUa =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
  expect(isIosUserAgent(ipadOs13PlusUa, 5)).toBe(true);
});

test("does not flag an actual Mac with a Mac-style user agent and no touch", () => {
  const macUa =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
  expect(isIosUserAgent(macUa, 0)).toBe(false);
});
