import { z } from "zod";
import {
  streamText,
  generateText,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CHAT_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";
import { systemPrompt, LANGUAGE } from "@/lib/ask/prompt";
import { askTools, CHAT_MAX_STEPS } from "@/lib/ask/tools";
import { takeAskToken } from "@/lib/ask/rate-limit";

/* The loop is up to seven steps of inference with database round-trips between
   them, so the platform default is not what should be bounding it —
   CHAT_INFERENCE_BUDGET_MS is. This only has to sit comfortably above that, with
   room for the auth and profile reads in front of it. */
export const maxDuration = 120;

function askModel() {
  return google(process.env.GOOGLE_ASK_MODEL ?? "gemini-3.6-flash");
}

/**
 * What the client may send.
 *
 * The messages are replayed to the model, so this is an input that reaches an
 * LLM and a bill. Unvalidated, `messages` was whatever JSON arrived: a thousand
 * turns of forged assistant text would have been transcribed straight into the
 * prompt. The caps are generous for a chat nobody persists and cheap to enforce.
 *
 * Asserts the three fields a UIMessage must have for `convertToModelMessages` to
 * read it, and stays loose about everything else: that schema belongs to the SDK
 * and moves with it, so restating it here would break on an upgrade while adding
 * nothing. What this file actually owns is the counts.
 */
const MAX_MESSAGES = 24;
const MAX_MESSAGE_BYTES = 4_000;

const BodySchema = z.object({
  messages: z
    .array(
      z.looseObject({
        id: z.string(),
        role: z.string(),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES)
    .refine(
      (messages) => messages.every((m) => JSON.stringify(m).length <= MAX_MESSAGE_BYTES),
      { message: "A message is too long." },
    ),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!takeAskToken(user.id, Date.now())) {
    return new Response("Too many questions", { status: 429 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });

  /* No .eq("id", ...) — RLS scopes the row, as lib/overview/queries.ts does. */
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();

  const locale = await getLocale();

  const result = streamText({
    model: askModel(),
    system: systemPrompt({
      today: new Date().toISOString().slice(0, 10),
      baseCurrency: profile?.base_currency ?? "DOP",
      language: LANGUAGE[locale] ?? LANGUAGE.en,
    }),
    messages: await convertToModelMessages(parsed.data.messages as unknown as UIMessage[]),
    tools: askTools(),
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    abortSignal: inferenceSignal(CHAT_INFERENCE_BUDGET_MS),
  });

  return result.toUIMessageStreamResponse({
    /* Without this the SDK replaces every failure with "An error occurred." and
       the page cannot tell a timeout from a broken key — so the one piece of
       actionable copy in the feature ("try a narrower date range") could never
       be shown. An aborted stream is the budget expiring; nothing else is.
       The sentinel is deliberately not prose: the client owns the wording, in
       whichever of the two languages is being read. */
    onError: (error) => (isAbort(error) ? "ASK_TIMEOUT" : "ASK_ERROR"),
  });
}

/**
 * Pays the cold-start cost while the person is still typing.
 *
 * `lib/llm/budget.ts` records that the first inference call in a fresh Node
 * process takes 9 to 70 seconds against ~600ms warm. Every other LLM feature
 * here absorbs that quietly — a card colour arrives late and nobody notices.
 * Chat is the one surface where someone sits watching a cursor, and the budget
 * loses a cold call outright.
 *
 * This lives in THIS file rather than in `/api/ask/warm` for the only reason
 * that matters: each route handler is its own function instance, so warming a
 * neighbouring route warms a process that will never serve the question. Same
 * route, same instance, same warm SDK client.
 *
 * And it is a real inference rather than a bare `fetch` to the host, because
 * what is slow is the SDK's first call, not DNS. One token out is close enough
 * to free; a question that answers in three seconds instead of forty is not.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  if (!takeAskToken(user.id, Date.now())) {
    return new Response(null, { status: 429 });
  }

  try {
    await generateText({
      model: askModel(),
      prompt: "ok",
      maxOutputTokens: 1,
      abortSignal: inferenceSignal(10_000),
    });
  } catch {
    // Warming is best-effort; a failure here costs latency, never correctness.
  }

  return new Response(null, { status: 204 });
}

/** An aborted call, however the SDK or the runtime chose to spell it. */
function isAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}
