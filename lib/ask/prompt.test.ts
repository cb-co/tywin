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

  /* The rule the model broke in testing: two statements in one call, then a
     wasted step, then no answer. */
  it("states the one-statement rule and how to combine two questions", () => {
    expect(systemPrompt(ctx)).toMatch(/one statement per call/i);
    expect(systemPrompt(ctx)).toMatch(/union all/i);
  });

  it("tells the model its query budget is reported back to it", () => {
    expect(systemPrompt(ctx)).toMatch(/how many are left/i);
  });

  /* The answer in the screenshot that started this: the model was writing
     markdown all along and the bubble rendered it as characters. The renderer is
     fixed, so what the prompt has to guarantee now is that the markdown stays
     inside the subset the renderer styles — anything else arrives unstyled or,
     for a link, dropped. */
  it("names the markdown subset the renderer supports", () => {
    const p = systemPrompt(ctx);
    expect(p).toMatch(/only these: \*\*bold\*\*, bullet lists, numbered lists, and tables/i);
    expect(p).toMatch(/no headings, no links/i);
  });

  /* Sixteen transactions with the amounts in brackets is the shape that was
     unreadable, and it is the shape a model reaches for by default. */
  it("asks for a table rather than amounts inside a sentence", () => {
    expect(systemPrompt(ctx)).toMatch(/is a table, never a sentence with the amounts in brackets/i);
  });

  it("shows the alignment syntax that right-aligns an amount column", () => {
    expect(systemPrompt(ctx)).toContain("| :--- | :--- | ---: |");
  });
});

describe("LANGUAGE", () => {
  it("covers both app locales", () => {
    expect(LANGUAGE.en).toBe("English");
    expect(LANGUAGE.es).toBe("Spanish");
  });
});
