import { describe, expect, it } from "vitest";
import { normalizeCurrency } from "./currency";

describe("normalizeCurrency", () => {
  it("passes an ISO code through", () => {
    expect(normalizeCurrency("DOP")).toBe("DOP");
    expect(normalizeCurrency("USD")).toBe("USD");
  });

  it("uppercases and trims", () => {
    expect(normalizeCurrency(" dop ")).toBe("DOP");
  });

  /* The bug this exists for: a Dominican statement prints "RD$" on every line and
     never the token "DOP", so the model transcribes the symbol. */
  it("maps a printed symbol to its ISO code", () => {
    expect(normalizeCurrency("RD$")).toBe("DOP");
    expect(normalizeCurrency("RD$ ")).toBe("DOP");
    expect(normalizeCurrency("US$")).toBe("USD");
  });

  /* The PDF text layer breaks symbols across spaces and non-breaking spaces, and
     the model transcribes whatever it sees. */
  it("ignores whitespace inside a symbol", () => {
    expect(normalizeCurrency("RD $")).toBe("DOP");
    expect(normalizeCurrency("RD\u00A0$")).toBe("DOP"); // non-breaking space
  });

  /* An ISO code the statement decorated with its own symbol. The three letters
     already name the currency, so this is a strip, not a guess. */
  it("strips a symbol appended to an ISO code", () => {
    expect(normalizeCurrency("USD$")).toBe("USD");
    expect(normalizeCurrency("DOP$")).toBe("DOP");
  });

  it("throws on a bare $ rather than guessing", () => {
    expect(() => normalizeCurrency("$")).toThrow(/currency/i);
  });

  it("throws on anything that is not a currency", () => {
    expect(() => normalizeCurrency("")).toThrow(/currency/i);
    expect(() => normalizeCurrency("N/A")).toThrow(/currency/i);
    expect(() => normalizeCurrency("DOLLARS")).toThrow(/currency/i);
  });

  it("produces a code Intl.NumberFormat accepts", () => {
    expect(() =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: normalizeCurrency("RD$") }),
    ).not.toThrow();
  });
});
