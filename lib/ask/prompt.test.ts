import { describe, expect, it } from "vitest";
import { systemPrompt, LANGUAGE } from "./prompt";

const ctx = { today: "2026-08-20", baseCurrency: "DOP", language: "English" };

describe("systemPrompt", () => {
  /* A model asked what day it is answers from training data, which silently
     corrupts every "last month" and "this week" question in the product. The
     date is injected for exactly this reason, so its absence is a bug worth a
     test rather than a comment. */
  it("states today's date", () => {
    expect(systemPrompt(ctx)).toContain("2026-08-20");
  });

  it("states the base currency", () => {
    expect(systemPrompt(ctx)).toContain("DOP");
  });

  it("names the language to answer in", () => {
    expect(systemPrompt({ ...ctx, language: "Spanish" })).toContain("Spanish");
  });

  it("carries the schema document", () => {
    expect(systemPrompt(ctx)).toContain("q_transactions");
    expect(systemPrompt(ctx)).toContain("budget_spend");
  });

  it("forbids advice, matching the house rule", () => {
    expect(systemPrompt(ctx)).toMatch(/investment, tax/i);
  });
});

describe("LANGUAGE", () => {
  it("covers both app locales", () => {
    expect(LANGUAGE.en).toBe("English");
    expect(LANGUAGE.es).toBe("Spanish");
  });
});
