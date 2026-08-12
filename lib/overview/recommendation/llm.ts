import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { DEFERRED_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";
import { asTone, type Tone } from "./tone";
import type { RecommendationSnapshot } from "./snapshot";

/**
 * One short piece of coaching about a person's own numbers.
 *
 * The third sibling of `lib/subscriptions/llm/brand.ts` and
 * `lib/accounts/llm/card-art.ts`: same provider, same call shape, same refusal
 * to trust the answer as given. What differs is the input. Those two are handed
 * a NAME and asked to recognise it; this one is handed a redacted table of
 * figures and asked to read it — see `snapshot.ts` for what is deliberately
 * absent from that table and why.
 *
 * The model gets one call and returns all three fields. As with brand identity,
 * a second call to "pick a tone" would double a worst case measured in tens of
 * seconds to buy a field the first call returns for free.
 */
export const RecommendationSchema = z.object({
  headline: z
    .string()
    .describe(
      "Three to six words naming the single thing worth noticing, in the requested language.",
    ),
  body: z.string().describe("One or two sentences about it, in the requested language."),
  tone: z
    .enum(["good", "watch", "neutral"])
    .describe("watch when flagging a risk, good when the news is good, neutral otherwise."),
});

export type Recommendation = { headline: string; body: string; tone: Tone };

/* next-intl gives a locale; the model needs a language it recognises by name.
   An unknown locale falls back to English rather than to the raw code, which a
   model would otherwise try to interpret. */
const LANGUAGE: Record<string, string> = { en: "English", es: "Spanish" };

function systemPrompt(language: string): string {
  return `You are a calm, practical money coach inside a personal finance app. You are given a snapshot of one person's finances as JSON, and you write one short piece of coaching about it.

Write in ${language}. Every word you return must be in ${language}.

Return three things.

headline — three to six words naming the single thing you want them to notice. Concrete, not a category label: "Dining is running hot", never "Budget update".

body — one or two sentences. Say what you noticed and, where there is a useful one, what to do about it. Refer to real figures from the snapshot.

tone — "watch" when you are flagging something that needs attention, "good" when the news is genuinely good, "neutral" otherwise. It must match what your body text actually says.

Rules:
- Pick the SINGLE most notable thing. Do not survey the whole snapshot. This is read in four seconds.
- Use ONLY the numbers you were given. Never invent a figure and never estimate one. A difference or a percentage of two given numbers is fine; anything else is not.
- No investment, tax, or legal advice. Do not name financial products, banks, or services.
- Observe without scolding. Someone over budget already knows. Say what helps.
- Say something worth reading even on a quiet day: a goal on pace, a month tracking under budget, a card that is nearly paid off are all worth naming.
- Do not greet, do not sign off, do not ask questions, do not explain yourself.
- Amounts are in baseCurrency unless the line names its own currency.

The snapshot contains no names — not the person's, not their bank's, not their subscriptions'. Do not ask for them and do not pretend to know them.`;
}

/**
 * Never throws, and returns null on anything that is not a usable answer.
 *
 * `tone` is narrowed rather than rejected, because it is the one field with a
 * safe default: a good headline and body should not be thrown away over a word
 * the CHECK constraint would refuse. `headline` and `body` have no such default
 * — an empty card is worse than no card — so an empty one is null.
 *
 * A call that overruns DEFERRED_INFERENCE_BUDGET_MS aborts and is treated like
 * any other failure. The budget is generous because nothing waits on this: the
 * overview has already rendered, so a cold call costs a card that fills in late
 * rather than a spinner anyone sits behind.
 */
export async function inferRecommendation(
  snapshot: RecommendationSnapshot,
  locale: string,
): Promise<Recommendation | null> {
  try {
    const { object } = await generateObject({
      model: google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite"),
      schema: RecommendationSchema,
      system: systemPrompt(LANGUAGE[locale] ?? LANGUAGE.en),
      prompt: JSON.stringify(snapshot),
      abortSignal: inferenceSignal(DEFERRED_INFERENCE_BUDGET_MS),
    });

    const headline = object.headline?.trim() ?? "";
    const body = object.body?.trim() ?? "";
    if (!headline || !body) return null;

    return { headline, body, tone: asTone(object.tone) };
  } catch {
    return null;
  }
}
