/**
 * Pays the cold-start cost while the user is still typing.
 *
 * lib/llm/budget.ts records that the first inference call in a fresh Node
 * process takes 9 to 70 seconds against ~600ms warm, and that a plain fetch to
 * the host beforehand is enough to fix it. Every other LLM feature here absorbs
 * that quietly — a card colour arrives late and nobody notices. Chat is the one
 * surface where a person sits watching a cursor, and a 15s budget loses a cold
 * call outright, so the cost is moved off the critical path instead.
 */
export async function GET() {
  try {
    await fetch("https://generativelanguage.googleapis.com/", {
      method: "HEAD",
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // Warming is best-effort; a failure here costs latency, never correctness.
  }
  return new Response(null, { status: 204 });
}
