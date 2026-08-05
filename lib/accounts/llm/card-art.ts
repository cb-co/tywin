import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { CARD_NETWORKS, type CardNetwork } from "@/lib/accounts/network";
import { HEX6 } from "@/lib/accounts/card-art";

/**
 * Card art inferred from the name a person gave their card.
 *
 * People name cards after the real product — "Amex Platinum", "Chase Sapphire
 * Reserve", "BHD León Visa Infinite". That name is enough for a model to
 * recognise the actual card and report what colour it is, which is the one
 * piece of card art we can get without asking anyone to upload anything.
 *
 * Same provider and call shape as the statement extractor
 * (`lib/statements/llm/extract.ts`): Gemini through the AI SDK with a
 * schema-constrained response, so the model cannot return a shape we then have
 * to defend against.
 */
export const CardArtSchema = z.object({
  accent: z
    .string()
    .describe(
      "The dominant colour of the physical card, as a 6-digit hex like #1B4B8F.",
    ),
  network: z
    .enum(CARD_NETWORKS)
    .nullable()
    .describe("The payment network, or null if the name does not make it certain."),
});

export type CardArt = { accent: string; network: CardNetwork | null };

const SYSTEM_PROMPT = `You identify consumer credit and debit cards from the name a person gave the card in their own finance app.

Return two things.

1. accent — the dominant colour of the PHYSICAL card, as a 6-digit hex.
   - If you recognise the specific card product, use that card's real colour. An Amex Platinum is silver-grey, an Amex Gold is warm gold, a Chase Sapphire Reserve is deep blue.
   - If you recognise only the issuing bank, use that bank's primary brand colour.
   - If you recognise neither, choose a plausible, sober card colour. Never invent a wildly bright or novelty colour for a card you do not recognise.
   - The colour is used as a card background with text on top. Stay in the mid-to-dark range so it reads as a card. Avoid near-white (lighter than #D0D0D0) and pure black.
   - Prefer a saturated, confident colour over a muddy one.

2. network — the payment network, ONLY when the name makes it certain.
   - Return null if you are not sure. A wrong network mark on someone's card is worse than no mark at all.
   - The card's issuing bank is not the network. "BHD León" alone does not tell you the network; "BHD León Visa" does.
   - An Amex-branded card is always the amex network.

Judge only from the name. Do not ask questions, do not explain.`;

/**
 * Resolves art for one card name. Returns null on any failure — a missing
 * accent is a cosmetic gap that the default colour covers, so nothing here is
 * worth surfacing as an error or blocking a save for.
 *
 * Deliberately not retried and not cached: it runs once per card, only when the
 * card has no accent yet (see the callers in accounts/actions.ts). A card whose
 * name the model cannot place stays unresolved and simply gets the default,
 * rather than being written a wrong colour that nothing would ever revisit.
 */
export async function inferCardArt(name: string): Promise<CardArt | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const { object } = await generateObject({
      model: google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite"),
      schema: CardArtSchema,
      system: SYSTEM_PROMPT,
      prompt: trimmed,
    });

    // The schema constrains the shape, not the contents: `accent` is a string,
    // and the model can still hand back "navy" or "#FFF". Anything that would
    // not survive the colour maths is dropped rather than stored.
    const accent = object.accent?.trim() ?? "";
    if (!HEX6.test(accent)) return null;

    return { accent, network: object.network };
  } catch {
    return null;
  }
}
