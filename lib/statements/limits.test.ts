import { describe, expect, it } from "vitest";
import { MAX_STATEMENT_BYTES, SERVER_ACTION_BODY_LIMIT } from "./limits";

/** Parses the `"12mb"` shape Next's config takes, so the test compares the two
 *  limits in the same unit rather than trusting a hand-checked pair. */
function toBytes(limit: string): number {
  const match = /^(\d+(?:\.\d+)?)mb$/.exec(limit);
  if (!match) throw new Error(`unsupported limit format: ${limit}`);
  return Number(match[1]) * 1024 * 1024;
}

describe("statement upload limits", () => {
  it("leaves the server limit room above the file limit for multipart overhead", () => {
    // A file at exactly MAX_STATEMENT_BYTES still travels with field names,
    // boundaries, the account id and the action payload. If the server limit
    // were equal, the largest accepted file would be rejected by Next before
    // the action could report anything.
    expect(toBytes(SERVER_ACTION_BODY_LIMIT)).toBeGreaterThan(MAX_STATEMENT_BYTES);
  });

  it("accepts a statement PDF of a realistic size", () => {
    // Text-layer statements run a few hundred KB; ones carrying page images
    // reach a few MB. The default this replaced was 1MB, which real statements
    // exceed.
    expect(MAX_STATEMENT_BYTES).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });
});
