// Usage: node scripts/parse-statement.mjs <path.pdf> [password]
// Prints parser id, per-section totals, line counts, checksum result.
import { readFile } from "node:fs/promises";
import { extractStatementText } from "../lib/statements/extract.ts";
import { detectParser } from "../lib/statements/registry.ts";
import { validateChecksums } from "../lib/statements/validate.ts";
import { centsToDecimal } from "../lib/statements/money.ts";

const [path, password] = process.argv.slice(2);
const bytes = new Uint8Array(await readFile(path));
const extracted = await extractStatementText(bytes, password);
if (!extracted.ok) {
  console.error("extract failed:", extracted.reason);
  process.exit(1);
}
const parser = detectParser(extracted.text);
if (!parser) {
  console.error("no parser detected");
  process.exit(1);
}
const parsed = parser.parse(extracted.text);
console.log("parser:", parsed.parserId, "last4:", parsed.cardLast4);
for (const s of parsed.sections) {
  console.log(
    `  [${s.sectionKey}] ${s.currency} ${s.periodStart}..${s.periodEnd}`,
    `lines=${s.lines.length}`,
    `closing=${centsToDecimal(s.closingBalanceCents)}`,
    `carry=${s.costOfCarryCents === null ? "-" : centsToDecimal(s.costOfCarryCents)}`,
  );
}
const failures = validateChecksums(parsed);
console.log(failures.length ? failures : "checksums OK");
