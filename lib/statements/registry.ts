import type { StatementParser } from "./types";
import { popularVisa } from "./parsers/popular-visa";
import { scotiaAmex } from "./parsers/scotia-amex";

export const parsers: StatementParser[] = [popularVisa, scotiaAmex];

export function detectParser(text: string): StatementParser | null {
  return parsers.find((p) => p.detect(text)) ?? null;
}
