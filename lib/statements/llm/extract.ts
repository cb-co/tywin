import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { StatementSchema, type LlmLine, type LlmSection, type LlmStatement } from "./schema";
import { SYSTEM_PROMPT } from "./system-prompt";
import { parseMoneyCents } from "../money";
import { monthBeforePlusDay } from "../dates";
import type { ParsedLine, ParsedSection, ParsedStatement } from "../types";

export type LlmExtractResult =
  | { ok: true; statement: LlmStatement }
  | { ok: false; reason: "llm_error" };

export async function extractWithLLM(text: string): Promise<LlmExtractResult> {
  try {
    const { object } = await generateObject({
      model: groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"),
      schema: StatementSchema,
      system: SYSTEM_PROMPT,
      prompt: text,
    });
    return { ok: true, statement: object };
  } catch {
    return { ok: false, reason: "llm_error" };
  }
}

function toLine(l: LlmLine, index: number): ParsedLine {
  return {
    lineNo: index + 1,
    madeOn: l.madeOn,
    postedOn: l.postedOn,
    reference: l.reference,
    description: l.description,
    mcc: l.mcc,
    authCode: l.authCode,
    amountCents: parseMoneyCents(l.amount),
    kind: l.kind,
    suggestedCategory: l.suggestedCategory,
  };
}

function toSection(s: LlmSection): ParsedSection {
  const lines = s.lines.map(toLine);
  const totalDebitsCents =
    lines.length > 0
      ? lines.filter((l) => l.amountCents > 0).reduce((sum, l) => sum + l.amountCents, 0)
      : s.totalDebits !== null
        ? parseMoneyCents(s.totalDebits)
        : 0;
  const totalCreditsCents =
    lines.length > 0
      ? lines.filter((l) => l.amountCents < 0).reduce((sum, l) => sum - l.amountCents, 0)
      : s.totalCredits !== null
        ? parseMoneyCents(s.totalCredits)
        : 0;

  return {
    sectionKey: s.sectionKey,
    currency: s.currency,
    periodStart: monthBeforePlusDay(s.periodEnd),
    periodEnd: s.periodEnd,
    dueDate: s.dueDate,
    previousBalanceCents: parseMoneyCents(s.previousBalance),
    totalDebitsCents,
    totalCreditsCents,
    closingBalanceCents: parseMoneyCents(s.closingBalance),
    balanceToPayCents:
      s.balanceToPay !== null ? parseMoneyCents(s.balanceToPay) : parseMoneyCents(s.closingBalance),
    minimumPaymentCents: s.minimumPayment !== null ? parseMoneyCents(s.minimumPayment) : null,
    overdueAmountCents: s.overdueAmount !== null ? parseMoneyCents(s.overdueAmount) : null,
    overdueInstallments: s.overdueInstallments,
    creditLimitCents: s.creditLimit !== null ? parseMoneyCents(s.creditLimit) : null,
    availableCreditCents: s.availableCredit !== null ? parseMoneyCents(s.availableCredit) : null,
    interestRateAnnual: s.interestRateAnnual,
    avgDailyBalanceCents: s.avgDailyBalance !== null ? parseMoneyCents(s.avgDailyBalance) : null,
    avgDailyBalancePriorCents:
      s.avgDailyBalancePrior !== null ? parseMoneyCents(s.avgDailyBalancePrior) : null,
    costOfCarryCents: s.costOfCarry !== null ? parseMoneyCents(s.costOfCarry) : null,
    costOfCarryPriorCents: s.costOfCarryPrior !== null ? parseMoneyCents(s.costOfCarryPrior) : null,
    lines,
  };
}

export function toParsedStatement(statement: LlmStatement): ParsedStatement {
  const currencies = [...new Set(statement.sections.map((s) => s.currency))].sort();
  const parserId =
    `${statement.cardNetwork}_${statement.cardLast4 ?? "na"}_${currencies.join("")}`.toLowerCase();
  return {
    parserId,
    cardLast4: statement.cardLast4,
    sections: statement.sections.map(toSection),
  };
}
