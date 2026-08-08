import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt";

const CATEGORIES = [
  "Groceries", "Dining", "Transport", "Housing", "Utilities",
  "Health", "Shopping", "Entertainment", "Savings", "Other",
];

describe("SYSTEM_PROMPT", () => {
  it("lists every category name exactly once", () => {
    for (const c of CATEGORIES) expect(SYSTEM_PROMPT).toContain(c);
  });

  it("instructs the model never to reconstruct redacted PII", () => {
    expect(SYSTEM_PROMPT).toMatch(/never fabricate/i);
  });

  it("instructs numeric fidelity — no model-side arithmetic", () => {
    expect(SYSTEM_PROMPT).toMatch(/do not compute, round/i);
  });

  /* Left unspecified, the model transcribes the symbol the statement prints
     ("RD$") into a field every consumer reads as an ISO code. */
  it("demands an ISO currency code rather than the printed symbol", () => {
    expect(SYSTEM_PROMPT).toMatch(/ISO 4217/);
    expect(SYSTEM_PROMPT).toContain("RD$");
  });

  /* The section key is derived from sectionKind + currency now, so the prompt
     no longer names keys — it only has to describe which kind a section is. */
  it("describes the two section kinds instead of a key to construct", () => {
    expect(SYSTEM_PROMPT).toContain("installments");
    expect(SYSTEM_PROMPT).toContain("revolving");
    expect(SYSTEM_PROMPT).not.toContain("_CUOTAS");
  });

  /* Amounts are typed as numbers in the schema; a prompt that still showed
     quoted, comma-grouped examples would pull against the decoder. */
  it("asks for money as unformatted JSON numbers", () => {
    expect(SYSTEM_PROMPT).toMatch(/JSON number, not a string/i);
    expect(SYSTEM_PROMPT).toMatch(/no currency symbol, no thousands separator/i);
  });

  /* Statements that print debits and credits in two columns encode the sign by
     position; flattened to text, an unsigned payment read as a charge moves the
     computed balance by twice its value. */
  it("explains that a credit-column amount is negative even when printed unsigned", () => {
    expect(SYSTEM_PROMPT).toMatch(/further-right column is payments and credits/i);
    expect(SYSTEM_PROMPT).toMatch(/MUST carry a negative sign/);
  });

  /* Some issuers draw the summary table as artwork, so the text layer keeps the
     figures and loses every heading. Without this the model reports a previous
     balance of 0 and the checksum rejects an otherwise perfect extraction. */
  it("tells the model how to read a summary block whose labels are missing", () => {
    expect(SYSTEM_PROMPT).toMatch(/UNLABELED SUMMARY BLOCKS/);
    expect(SYSTEM_PROMPT).toMatch(/the one left over is the previous balance/i);
    expect(SYSTEM_PROMPT).toMatch(/never invent or adjust a number to make it balance/i);
  });

  /* The worked example teaches the matching method. Its figures are synthetic
     on purpose — reusing a real statement's numbers invites the model to
     reproduce them as an answer instead of following the reasoning. */
  it("keeps the worked example's figures self-consistent and clearly synthetic", () => {
    expect(SYSTEM_PROMPT).toContain("1200.00 + 9875.40 - 350.00 = 10725.40");
    expect(SYSTEM_PROMPT).toMatch(/never carry them into your output/i);
  });
});
