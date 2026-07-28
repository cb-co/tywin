import { describe, expect, test } from "vitest";
import { config } from "./proxy";

/* The Android TWA is only chrome-less when Chrome can fetch
 * /.well-known/assetlinks.json and get a plain 200. The Digital Asset Links
 * verifier is unauthenticated and does not follow redirects, so the auth proxy
 * sending it to /login is enough to leave the address bar showing. This pins
 * the matcher so `.well-known` never falls back under the proxy. */

const matches = (pathname: string) =>
  config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));

describe("proxy matcher", () => {
  test("skips .well-known so Digital Asset Links stays reachable", () => {
    expect(matches("/.well-known/assetlinks.json")).toBe(false);
    expect(matches("/.well-known/apple-app-site-association")).toBe(false);
  });

  test("still guards app routes", () => {
    expect(matches("/transactions")).toBe(true);
    expect(matches("/accounts/statements")).toBe(true);
  });
});
