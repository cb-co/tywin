import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { normalizeHex6 } from "@/lib/color";
import { DEFERRED_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";

/**
 * The brand colour of a subscription, inferred from what the person called it.
 *
 * The sibling of `lib/accounts/llm/card-art.ts`, and for the same reason: people
 * name a subscription after the real service — "Netflix", "Spotify", "Adobe
 * Creative Cloud" — and that name is enough for a model to recognise the company
 * and report the colour everyone already associates with it. It is the one piece
 * of brand art available without asking anyone to upload a logo.
 *
 * Same provider and call shape as card art and the statement extractor: Gemini
 * through the AI SDK with a schema-constrained response.
 *
 * The PROMPT is where this differs from card art, and the difference is not
 * cosmetic. A card accent has to stay mid-to-dark because it becomes a whole
 * card face with text across it; a brand colour fills a 40px avatar with a
 * single letter on it, so Spotify green and Netflix red are exactly right there
 * and would be wrong on a card. The only real constraint is that the mark must
 * not vanish into the surface it sits on.
 */
export const BrandColorSchema = z.object({
  color: z
    .string()
    .describe("The brand's primary colour as a 6-digit hex, including the leading #, like #E50914."),
});

const SYSTEM_PROMPT = `You identify subscription services from the name a person gave the subscription in their own finance app, and report the brand's colour.

Return one thing: color — the brand's primary colour, as a 6-digit hex INCLUDING the leading # (for example #E50914, never E50914).

- If you recognise the service, use its real brand colour. Netflix is its red, Spotify its green, Disney+ its deep navy blue.
- If the brand's primary colour is white or near-white, use the colour of its logo mark or its main secondary colour instead. Never return a near-white value (nothing lighter than #E8E8E8) — the colour becomes a small filled avatar, and a white one reads as a rendering failure rather than a brand.
- A near-black brand colour is fine; plenty of brands really are black.
- If you recognise only the parent company, use the parent's colour.
- If you recognise nothing, choose one plausible, confident colour for a service of that kind. Prefer a saturated colour over a muddy one. Do not return grey as a way of hedging.

Judge only from the name. Do not ask questions, do not explain.`;

/**
 * Resolves the brand colour for one subscription name. Returns null on any
 * failure — an unresolved colour is a cosmetic gap the theme's neutral accent
 * covers, so nothing here is worth surfacing as an error or blocking a save for.
 *
 * Deliberately not retried and not cached: it runs once per subscription, only
 * when that subscription has no colour yet (see the callers in
 * subscriptions/actions.ts). A name the model cannot place stays unresolved and
 * renders neutral, rather than being written a wrong colour that nothing would
 * ever revisit.
 *
 * A call that overruns DEFERRED_INFERENCE_BUDGET_MS aborts and is treated
 * exactly like a name the model could not place. The budget is generous because
 * this no longer runs inside the save — resolveSubscriptionColor calls it after
 * the save has returned, so a cold call costs a late colour, not a spinner.
 */
export async function inferBrandColor(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const { object } = await generateObject({
      model: google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite"),
      schema: BrandColorSchema,
      system: SYSTEM_PROMPT,
      prompt: trimmed,
      abortSignal: inferenceSignal(DEFERRED_INFERENCE_BUDGET_MS),
    });

    /* The schema constrains the shape, not the contents: `color` is a string,
       and the model can still hand back "red" or "#FFF". Normalised before it is
       judged, because the one thing it gets wrong most often is the leading `#`
       — see normalizeHex6. Anything that still would not survive the contrast
       maths is dropped rather than stored. */
    return normalizeHex6(object.color);
  } catch {
    return null;
  }
}
