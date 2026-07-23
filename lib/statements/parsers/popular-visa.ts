import type { ParsedLine, ParsedStatement, StatementParser } from "../types";
import { parseMoneyCents } from "../money";
import { ddmmyyyyToIso, inferYear, monthBeforePlusDay } from "../dates";

const HEADER =
  /^\s*\*{4}-\*{4}-\*{4}-(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(-?[\d,]+\.\d{2})\s*$/;
const TXN =
  /^\s*(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d+)\s+(.+?)\s{2,}(-?[\d,]+\.\d{2})\s*$/;
const CONT = /^\s*(\d{4})\s+(\d{6})\s*$/;
const FOOTER =
  /^\s*(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const money = (label: RegExp, text: string): number | null => {
  const m = text.match(label);
  return m ? parseMoneyCents(m[1]) : null;
};

export const popularVisa: StatementParser = {
  id: "popular_visa",

  detect(text) {
    return /RNC\s*101010632/.test(text);
  },

  parse(text) {
    const lines = text.split("\n");

    const headerLine = lines.find((l) => HEADER.test(l));
    const header = headerLine?.match(HEADER);
    if (!header) throw new Error("popular_visa: header line not found");
    const [, last4, limit, available, cutoff, due, previous] = header;
    const periodEnd = ddmmyyyyToIso(cutoff);

    // Footer appears on every page; the first is authoritative. It follows
    // the CUOTAS VENCIDAS heading, which keeps it unambiguous vs. other rows.
    let footer: RegExpMatchArray | null = null;
    for (let i = 0; i < lines.length && !footer; i++) {
      if (/VENCIDAS/.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const m = lines[j].match(FOOTER);
          if (m) { footer = m; break; }
        }
      }
    }
    if (!footer) throw new Error("popular_visa: totals footer not found");

    const parsedLines: ParsedLine[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(TXN);
      if (!m) continue;
      const [, posted, made, reference, rawDesc, rawAmount] = m;
      // Popular acquirer references are unique per transaction; the key only
      // collides on page-repeat, so this dedupes reprinted header/footer pages
      // without ever conflating two distinct transactions.
      const key = `${reference}|${rawAmount}|${posted}|${made}`;
      if (seen.has(key)) continue; // page overlap safety
      seen.add(key);

      const cont = i + 1 < lines.length ? lines[i + 1].match(CONT) : null;
      const amountCents = parseMoneyCents(rawAmount);
      const description = rawDesc.trim().replace(/\s{2,}/g, " ");
      parsedLines.push({
        lineNo: parsedLines.length + 1,
        madeOn: inferYear(made, periodEnd),
        postedOn: inferYear(posted, periodEnd),
        reference,
        description,
        mcc: cont ? cont[1] : null,
        authCode: cont ? cont[2] : null,
        amountCents,
        kind:
          amountCents < 0
            ? /^pago/i.test(description) ? "payment" : "credit"
            : /^CARGO/.test(description) ? "fee" : "purchase",
        suggestedCategory: null,
      });
    }

    const totalDebitsCents = parsedLines
      .filter((l) => l.amountCents > 0)
      .reduce((s, l) => s + l.amountCents, 0);
    const totalCreditsCents = parsedLines
      .filter((l) => l.amountCents < 0)
      .reduce((s, l) => s - l.amountCents, 0);

    return {
      parserId: "popular_visa",
      cardLast4: last4,
      sections: [
        {
          sectionKey: "DOP",
          currency: "DOP",
          periodStart: monthBeforePlusDay(periodEnd),
          periodEnd,
          dueDate: ddmmyyyyToIso(due),
          previousBalanceCents: parseMoneyCents(previous),
          totalDebitsCents,
          totalCreditsCents,
          closingBalanceCents: parseMoneyCents(footer[5]),
          balanceToPayCents: parseMoneyCents(footer[4]),
          minimumPaymentCents: parseMoneyCents(footer[3]),
          overdueAmountCents: parseMoneyCents(footer[2]),
          overdueInstallments: Number(footer[1]),
          creditLimitCents: parseMoneyCents(limit),
          availableCreditCents: parseMoneyCents(available),
          interestRateAnnual: (() => {
            const m = text.match(/Tasa de Inter[eé]s Anual[\s.]*:?\s*([\d.]+)\s*%/);
            return m ? Number(m[1]) : null;
          })(),
          avgDailyBalanceCents: money(
            /Saldo Promedio Diario de los Consumos del Mes\s+(-?[\d,]+\.\d{2})/, text),
          avgDailyBalancePriorCents: money(
            /Saldo Promedio Diario del Capital Pendiente de Meses Anteriores\s+(-?[\d,]+\.\d{2})/, text),
          costOfCarryCents: money(
            /Inter[eé]s si Opta Por Financiar los Consumos del Mes\s+(-?[\d,]+\.\d{2})/, text),
          costOfCarryPriorCents: money(
            /Inter[eé]s por Financiamiento del Capital Pendiente de Meses Anteriores\s+(-?[\d,]+\.\d{2})/, text),
          lines: parsedLines,
        },
      ],
    } satisfies ParsedStatement;
  },
};
