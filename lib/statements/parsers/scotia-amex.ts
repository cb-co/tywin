import type { ParsedLine, ParsedSection, ParsedStatement, StatementParser } from "../types";
import { parseMoneyCents } from "../money";
import { ddmmyyyyToIso, monthBeforePlusDay } from "../dates";

const TXN =
  /^\s*(\d{4})\.?\s+(\d{2}\/\d{2}\/\d{4})\.?\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}(-?[\d,]+\.\d{2})\.?\s*$/;
const MONEDA_ROW =
  /^\s*(DOP|USD|Cuotas Scotiabank DOP)\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const RESUMEN_ROW =
  /^\s*(DOP|USD|Cuotas Scotiabank DOP)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

const KEYS: Record<string, string> = {
  DOP: "DOP",
  USD: "USD",
  "Cuotas Scotiabank DOP": "CUOTAS_DOP",
};
const slashDate = (s: string) => ddmmyyyyToIso(s.replace(/\./g, "").trim());

function lineKind(detail: string, amountCents: number): ParsedLine["kind"] {
  if (/^(PAGOS TARJETAS|PAGO )/i.test(detail)) return "payment";
  if (amountCents < 0) return "credit";
  if (/^CARGO /.test(detail)) return "fee";
  return "purchase";
}

export const scotiaAmex: StatementParser = {
  id: "scotia_amex",

  detect(text) {
    return /RNC\s*101-04359-8/.test(text);
  },

  parse(text) {
    const lines = text.split("\n");

    const cutMatch = text.match(/Fecha de Corte:\s*(\d{2}-\d{2}-\d{4})/);
    const dueMatch = text.match(/Fecha l[ií]mite de pago:\s*(\d{2}-\d{2}-\d{4})/);
    const cardMatch = text.match(/\*{6,}(\d{4})/);
    if (!cutMatch) throw new Error("scotia_amex: fecha de corte not found");
    const periodEnd = ddmmyyyyToIso(cutMatch[1]);
    const periodStart = monthBeforePlusDay(periodEnd);
    const dueDate = dueMatch ? ddmmyyyyToIso(dueMatch[1]) : null;

    // Header tables: first occurrence per row label wins (pages repeat them).
    const moneda = new Map<string, RegExpMatchArray>();
    const resumen = new Map<string, RegExpMatchArray>();
    for (const l of lines) {
      const mm = l.match(MONEDA_ROW);
      if (mm && !moneda.has(mm[1])) moneda.set(mm[1], mm);
      const rm = l.match(RESUMEN_ROW);
      if (rm && !resumen.has(rm[1])) resumen.set(rm[1], rm);
    }

    // Walk the detail sections, collecting lines + per-section footers.
    type Open = { key: string; currency: string; lines: ParsedLine[]; footer: Record<string, number>; apr: number | null };
    const open = new Map<string, Open>();
    let current: Open | null = null;
    const FOOTERS: Array<[RegExp, string]> = [
      [/Balance al Corte\s+(-?[\d,]+\.\d{2})/, "closing"],
      [/Balance Promedio Diario de Capital del Mes\s+(-?[\d,]+\.\d{2})/, "avg"],
      [/Balance Promedio Diario de Capital Anterior\s+(-?[\d,]+\.\d{2})/, "avgPrior"],
      [/Intereses Nuevos Consumos\s+(-?[\d,]+\.\d{2})/, "carry"],
      [/Intereses por Financiamiento del Mes\s+(-?[\d,]+\.\d{2})/, "carryPrior"],
    ];
    for (const l of lines) {
      const dop = /Detalle Transacciones en Pesos/.test(l);
      const usd = /Detalle Transacciones en D[oó]lares/.test(l);
      if (dop || usd) {
        const key = dop ? "DOP" : "USD";
        if (!open.has(key)) {
          const aprMatch = l.match(/Tasa de Inter[eé]s Anual \w+:\s*([\d.]+)\s*%/);
          open.set(key, { key, currency: key, lines: [], footer: {}, apr: aprMatch ? Number(aprMatch[1]) : null });
        }
        current = open.get(key)!;
        continue;
      }
      if (/Desprenda esta porci/i.test(l) || /Cuotas Scotiabank por facturar/i.test(l) || /^\s*-{20,}\s*$/.test(l)) {
        current = null;
        continue;
      }
      if (!current) continue;
      const t = l.match(TXN);
      if (t) {
        const [, , made, posted, detail, rawAmount] = t;
        const amountCents = parseMoneyCents(rawAmount);
        const description = detail.trim().replace(/\s{2,}/g, " ");
        current.lines.push({
          lineNo: current.lines.length + 1,
          madeOn: slashDate(made),
          postedOn: slashDate(posted),
          reference: null,
          description,
          mcc: null,
          authCode: null,
          amountCents,
          kind: lineKind(description, amountCents),
        });
        continue;
      }
      for (const [re, name] of FOOTERS) {
        const m = l.match(re);
        if (m && current.footer[name] === undefined) current.footer[name] = parseMoneyCents(m[1]);
      }
    }

    const sections: ParsedSection[] = [];
    for (const [label, key] of Object.entries(KEYS)) {
      const mon = moneda.get(label);
      const res = resumen.get(label);
      if (!mon || !res) continue;
      const o = open.get(key) ?? null;
      const previousBalanceCents = parseMoneyCents(res[2]);
      const statedDebits = parseMoneyCents(res[3]) + parseMoneyCents(res[4]);
      const statedCredits = -parseMoneyCents(res[5]);
      const sectionLines = o?.lines ?? [];
      if (o && sectionLines.length > 0 && o.footer.closing === undefined) {
        throw new Error(`scotia_amex: missing footer for section ${key}`);
      }
      const totalDebitsCents = sectionLines.length
        ? sectionLines.filter((l) => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0)
        : statedDebits;
      const totalCreditsCents = sectionLines.length
        ? sectionLines.filter((l) => l.amountCents < 0).reduce((s, l) => s - l.amountCents, 0)
        : statedCredits;
      const closing = o?.footer.closing ?? parseMoneyCents(res[7]);
      sections.push({
        sectionKey: key,
        currency: label === "USD" ? "USD" : "DOP",
        periodStart,
        periodEnd,
        dueDate,
        previousBalanceCents,
        totalDebitsCents,
        totalCreditsCents,
        closingBalanceCents: closing,
        balanceToPayCents: closing,
        minimumPaymentCents: parseMoneyCents(mon[4]),
        overdueAmountCents: null,
        overdueInstallments: null,
        creditLimitCents: parseMoneyCents(mon[2]),
        availableCreditCents: null,
        interestRateAnnual: o?.apr ?? null,
        avgDailyBalanceCents: o?.footer.avg ?? parseMoneyCents(res[6]),
        avgDailyBalancePriorCents: o?.footer.avgPrior ?? null,
        costOfCarryCents: o?.footer.carry ?? null,
        costOfCarryPriorCents: o?.footer.carryPrior ?? null,
        lines: sectionLines,
      });
    }
    if (!sections.length) throw new Error("scotia_amex: no sections found");

    return { parserId: "scotia_amex", cardLast4: cardMatch ? cardMatch[1] : null, sections } satisfies ParsedStatement;
  },
};
