import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CHAT_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";
import { systemPrompt, LANGUAGE } from "@/lib/ask/prompt";
import { askTools, CHAT_MAX_STEPS } from "@/lib/ask/tools";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();

  /* No .eq("id", ...) — RLS scopes the row, as lib/overview/queries.ts does. */
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();

  const locale = await getLocale();

  const result = streamText({
    model: google(process.env.GOOGLE_ASK_MODEL ?? "gemini-3.6-flash"),
    system: systemPrompt({
      today: new Date().toISOString().slice(0, 10),
      baseCurrency: profile?.base_currency ?? "DOP",
      language: LANGUAGE[locale] ?? LANGUAGE.en,
    }),
    messages: await convertToModelMessages(messages),
    tools: askTools(),
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    abortSignal: inferenceSignal(CHAT_INFERENCE_BUDGET_MS),
  });

  return result.toUIMessageStreamResponse();
}
