// Usage: node scripts/parse-statement-llm.mjs <path.pdf> [password]
// Extracts, scrubs, and runs the Groq extraction pipeline against a real PDF on disk.
// Requires GROQ_API_KEY (and optionally GROQ_MODEL) in the environment.
import { readFile } from "node:fs/promises";
import { extractStatementText } from "../lib/statements/extract.ts";
import { scrubPii } from "../lib/statements/llm/scrub-pii.ts";
import { extractWithLLM, toParsedStatement } from "../lib/statements/llm/extract.ts";
import { validateChecksums } from "../lib/statements/validate.ts";
import { centsToDecimal } from "../lib/statements/money.ts";

const [path, password] = process.argv.slice(2);
const bytes = new Uint8Array(await readFile(path));
const extracted = await extractStatementText(bytes, password);
if (!extracted.ok) {
  console.error("extract failed:", extracted.reason);
  process.exit(1);
}

const scrubbed = scrubPii(extracted.text);
console.log("--- scrubbed text preview (first 500 chars) ---");
console.log(scrubbed.slice(0, 500));

const llmResult = await extractWithLLM(scrubbed);
if (!llmResult.ok) {
  console.error("llm extraction failed:", llmResult.reason);
  process.exit(1);
}

const parsed = toParsedStatement(llmResult.statement);
console.log("\nparserId:", parsed.parserId, "cardLast4:", parsed.cardLast4);
for (const s of parsed.sections) {
  console.log(
    `  [${s.sectionKey}] ${s.currency} ${s.periodStart}..${s.periodEnd}`,
    `lines=${s.lines.length}`,
    `closing=${centsToDecimal(s.closingBalanceCents)}`,
  );
}
const failures = validateChecksums(parsed);
console.log(failures.length ? failures : "checksums OK");
