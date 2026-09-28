/**
 * PDF → layout-preserved text for the statement parsers.
 *
 * pdfjs gives positioned text runs; parsers need lines where columns are
 * separated by 2+ spaces. Runs are grouped into rows by y (0.5pt tolerance —
 * real columns share an exact baseline y; see note below), sorted by x, and
 * joined with spacing proportional to the horizontal gap.
 * Passwords are used in memory only — never persisted (spec §3.1).
 */
// pdfjs polyfills DOMMatrix/Path2D from @napi-rs/canvas, but loads it via
// process.getBuiltinModule("module").createRequire() — invisible to Vercel's
// file tracer, so the package never reached the serverless bundle and pdf.mjs
// died at module load with `ReferenceError: DOMMatrix is not defined` (it
// builds a DOMMatrix at top level). This side-effect import exists purely so
// the tracer ships the package + its platform binary; pdfjs still resolves it
// through its own require. Kept external via serverExternalPackages — it's a
// native addon.
import path from "node:path";
import "@napi-rs/canvas";
// Same tracer blindness, second file: in Node pdfjs has no real Worker, so
// getDocument() falls back to a "fake worker" it loads via
// `await import(this.workerSrc)` — a variable specifier Vercel's tracer can't
// follow, so pdf.worker.mjs never reached the serverless bundle and every
// getDocument() rejected with "Setting up fake worker failed", which the
// import flow misread as an unreadable PDF (the password prompt never got a
// chance). Importing the worker statically ships the file AND short-circuits
// the dynamic import entirely: the module registers itself on
// globalThis.pdfjsWorker, which pdfjs checks first.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// The worker fetches each standard (non-embedded) font's glyph data by name
// on demand. In the browser that goes over `fetch()`, but the fake worker
// here runs in plain Node, where pdfjs's own NodeBinaryDataFactory reads
// standardFontDataUrl with `fs.readFile` instead — a URL would fail outright
// (Node's fetch has no `file:` scheme), so this has to be a filesystem path,
// not a URL. Resolved off pdf.mjs — the one pdfjs-dist file guaranteed to be
// in the deployed function, since it's imported statically above — so it
// still points at the right directory however the package is installed. NOT
// off package.json: the tracer doesn't ship it, and resolving it threw
// MODULE_NOT_FOUND at module load in production, taking down every page that
// imports this file. The trailing slash matters; pdfjs concatenates it
// straight onto the filename. Without this at all, it only warns "Ensure
// standardFontDataUrl is provided" and falls back to a built-in glyph map
// that mismaps some characters — never a thrown error — so a failed lookup
// degrades to exactly that rather than crashing the import.
//
// Same tracer blindness as @napi-rs/canvas above: these are read by a
// runtime-built path, invisible to Vercel's file tracer, so
// next.config.ts's outputFileTracingIncludes ships the directory explicitly.
const STANDARD_FONT_DATA_URL = (() => {
  try {
    const nodeRequire = process.getBuiltinModule("module").createRequire(import.meta.url);
    const pdfPath = nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs") as string;
    return `${path.join(path.dirname(pdfPath), "..", "..", "standard_fonts")}/`;
  } catch (err) {
    console.error("[statements] could not locate pdfjs standard_fonts", err);
    return undefined;
  }
})();

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "password_required" | "bad_password" | "unreadable" };

type Run = { str: string; x: number; y: number; w: number };

export async function extractStatementText(
  data: Uint8Array,
  password?: string,
): Promise<ExtractResult> {
  // pdfjs transfers (detaches) the input buffer to its worker via a
  // structuredClone transfer list — the caller's `data` would be unusable
  // after a single call, and a second extractStatementText() call reusing
  // the same buffer (wrong-password retry, or a caller that re-parses the
  // same in-memory bytes) throws DataCloneError: "Cannot transfer object of
  // unsupported type." Pass pdfjs a private copy so the caller's buffer is
  // never consumed and repeated calls on the same input keep working.
  //
  // isEvalSupported was dropped from DocumentInitParameters in pdfjs-dist 6.x
  // (eval-based code paths were removed); no CSP-relevant flag is needed here.
  const loadingTask = getDocument({
    data: data.slice(),
    password,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    // destroy() lives on the loading task, not on a (never-resolved) doc
    // proxy; call it here too so a wrong-password retry — the common path
    // once the UI lands — doesn't leak a worker per attempt.
    await loadingTask.destroy();
    const e = err as { name?: string; code?: number };
    if (e.name === "PasswordException") {
      // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      return { ok: false, reason: e.code === 2 ? "bad_password" : "password_required" };
    }
    return { ok: false, reason: "unreadable" };
  }

  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        runs.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
        });
      }
      // Group into rows by y (descending page order). Columns within one real
      // row share an *exact* baseline y in these statements (0.00pt diff);
      // stray page furniture (running footer notes, page numbers) can land
      // within a couple points of an unrelated table row's y, so a loose
      // tolerance here risks splicing that furniture into a transaction line
      // and corrupting the parser regexes. 0.5pt allows for float rounding
      // noise while still keeping distinct visual rows apart.
      runs.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows: Run[][] = [];
      for (const run of runs) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(row[0].y - run.y) <= 0.5) row.push(run);
        else rows.push([run]);
      }
      const lines = rows.map((row) => {
        row.sort((a, b) => a.x - b.x);
        let line = "";
        let cursor = 0; // running x in pt
        for (const run of row) {
          const gap = run.x - cursor;
          // ~4pt per character; 2+ spaces marks a column boundary for the
          // parsers. A gap over 6pt (more than a space-and-a-half at this
          // scale) is treated as a genuine column break and floored to 2
          // spaces even if the rounded gap/4 would give fewer, so adjacent
          // columns with a modest gap don't collapse to a single space.
          const spaces = line === "" ? Math.round(run.x / 4) : Math.max(gap > 6 ? 2 : 1, Math.round(gap / 4));
          line += " ".repeat(Math.max(spaces, line === "" ? 0 : 1)) + run.str;
          cursor = run.x + run.w;
        }
        return line;
      });
      pages.push(lines.join("\n"));
    }
    return { ok: true, text: pages.join("\n") };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    // destroy() lives on the loading task, not on the resolved
    // PDFDocumentProxy (pdfjs-dist 6.x); run unconditionally so a mid-loop
    // failure doesn't leak the worker/transport.
    await loadingTask.destroy();
  }
}
