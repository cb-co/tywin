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

  it("pins the sectionKey naming convention", () => {
    expect(SYSTEM_PROMPT).toContain("_CUOTAS");
  });
});
