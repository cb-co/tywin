export type LineKind = "purchase" | "fee" | "credit" | "payment";

export interface ParsedLine {
  lineNo: number;
  madeOn: string;   // ISO date (yyyy-mm-dd) — the date the user made the transaction
  postedOn: string; // ISO date — bank posting date
  reference: string | null;
  description: string;
  mcc: string | null;
  authCode: string | null;
  amountCents: number; // negative = credit
  kind: LineKind;
  suggestedCategory: string | null; // LLM's best-guess category name, non-authoritative
}

export interface ParsedSection {
  sectionKey: string;      // stable per parser: "DOP" | "USD" | "CUOTAS_DOP" | ...
  currency: string;        // ISO 4217
  periodStart: string;     // ISO date
  periodEnd: string;       // ISO date (fecha de corte) — the anchor date
  dueDate: string | null;
  previousBalanceCents: number;
  totalDebitsCents: number;   // Σ positive line amounts (or stated total when no lines)
  totalCreditsCents: number;  // Σ |negative| line amounts (or stated total)
  closingBalanceCents: number;   // BALANCE TOTAL / BALANCE AL CORTE — the anchor value
  balanceToPayCents: number;     // BALANCE A PAGAR (equals closing when absent)
  minimumPaymentCents: number | null;
  overdueAmountCents: number | null;
  overdueInstallments: number | null;
  creditLimitCents: number | null;
  availableCreditCents: number | null;
  interestRateAnnual: number | null;      // percent, e.g. 40 or 60
  avgDailyBalanceCents: number | null;
  avgDailyBalancePriorCents: number | null;
  costOfCarryCents: number | null;
  costOfCarryPriorCents: number | null;
  lines: ParsedLine[];
}

export interface ParsedStatement {
  parserId: string;
  cardLast4: string | null;
  sections: ParsedSection[];
}

export interface StatementParser {
  id: string;
  detect(text: string): boolean;
  parse(text: string): ParsedStatement;
}
