import { describe, expect, it } from "vitest";
import { popularVisa } from "./popular-visa";
import { POPULAR_FIXTURE, POPULAR_WRAP_FIXTURE } from "../fixtures/popular-visa";
import { validateChecksums } from "../validate";

describe("popularVisa.detect", () => {
  it("recognizes the RNC fingerprint", () => {
    expect(popularVisa.detect(POPULAR_FIXTURE)).toBe(true);
    expect(popularVisa.detect("some other bank RNC 999")).toBe(false);
  });
});

describe("popularVisa.parse", () => {
  const parsed = popularVisa.parse(POPULAR_FIXTURE);
  const s = parsed.sections[0];

  it("emits a single DOP section with header fields", () => {
    expect(parsed.parserId).toBe("popular_visa");
    expect(parsed.cardLast4).toBe("1234");
    expect(parsed.sections).toHaveLength(1);
    expect(s.sectionKey).toBe("DOP");
    expect(s.currency).toBe("DOP");
    expect(s.periodEnd).toBe("2026-06-25");
    expect(s.periodStart).toBe("2026-05-26");
    expect(s.dueDate).toBe("2026-07-20");
    expect(s.previousBalanceCents).toBe(100000);
    expect(s.creditLimitCents).toBe(1000000);
    expect(s.availableCreditCents).toBe(857450);
  });

  it("parses all six lines with kinds, MCC, and inferred years", () => {
    expect(s.lines).toHaveLength(6);
    const [mercado, gas, pago, resto, rebate, cargo] = s.lines;
    expect(mercado).toMatchObject({
      madeOn: "2026-05-26", postedOn: "2026-05-28",
      reference: "74763946147620851045422",
      mcc: "5411", authCode: "045602",
      amountCents: 50000, kind: "purchase",
    });
    expect(mercado.description).toBe("MERCADO UNO CIUDAD FALSA");
    expect(gas.kind).toBe("purchase");
    expect(pago).toMatchObject({ amountCents: -20000, kind: "payment", mcc: null });
    expect(resto.amountCents).toBe(7550);
    expect(rebate).toMatchObject({ amountCents: -5000, kind: "credit" });
    expect(cargo).toMatchObject({ kind: "fee", amountCents: 2500, mcc: null });
  });

  it("reads footer totals and cost of carry", () => {
    expect(s.closingBalanceCents).toBe(145050);
    expect(s.balanceToPayCents).toBe(145050);
    expect(s.minimumPaymentCents).toBe(14505);
    expect(s.overdueAmountCents).toBe(0);
    expect(s.overdueInstallments).toBe(0);
    expect(s.interestRateAnnual).toBe(40);
    expect(s.avgDailyBalanceCents).toBe(120000);
    expect(s.costOfCarryCents).toBe(4000);
    expect(s.avgDailyBalancePriorCents).toBe(0);
    expect(s.costOfCarryPriorCents).toBe(0);
  });

  it("computes totals from lines and passes the checksum", () => {
    expect(s.totalDebitsCents).toBe(70050);
    expect(s.totalCreditsCents).toBe(25000);
    expect(validateChecksums(parsed)).toEqual([]);
  });

  it("handles the December→January year wrap", () => {
    const wrap = popularVisa.parse(POPULAR_WRAP_FIXTURE);
    const line = wrap.sections[0].lines[0];
    expect(wrap.sections[0].periodEnd).toBe("2027-01-10");
    expect(line.madeOn).toBe("2026-12-27");
    expect(line.postedOn).toBe("2026-12-28");
  });

  it("does not duplicate lines when pages repeat headers/footers", () => {
    const doubled = popularVisa.parse(POPULAR_FIXTURE + POPULAR_FIXTURE);
    // header/footer parse first-occurrence; lines dedupe by reference+amount+dates
    expect(doubled.sections[0].lines).toHaveLength(6);
  });
});
