"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

export function AskChat() {
  const t = useTranslations("Ask");
  const [input, setInput] = useState("");
  const warmed = useRef(false);
  /* AI SDK v7 dropped the top-level `api` option from useChat — it now lives
     on the transport. See ai/dist/index.d.ts's ChatInit (no `api` field) and
     HttpChatTransportInitOptions (where `api` actually lives). */
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ask" }),
  });

  /* Pays the cold start while they are still reading the page. See
     app/api/ask/warm/route.ts for why this is not premature. */
  function warm() {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/ask/warm");
  }
  useEffect(warm, []);

  const busy = status === "submitted" || status === "streaming";

  /* The narration: the purpose of the most recent tool call, which the model
     writes in the user's language. Falls back to a generic line only for the
     gap before the first tool call arrives.

     `input` on a `tool-askQuery` part is a `DeepPartial<{sql, purpose}> |
     undefined` while the call is still streaming in (state
     "input-streaming"), and the full `{sql, purpose}` once the call is
     complete (state "input-available" and later) — see ToolUIPart /
     UIToolInvocation in ai/dist/index.d.ts. Either way `purpose` is only
     ever optional-chained here, so a partial or absent value just falls
     through to the generic line; no state check is required for safety. */
  const narration = (() => {
    const last = messages.at(-1);
    if (!busy || last?.role !== "assistant") return busy ? t("thinking") : null;
    const calls = last.parts.filter((p) => p.type === "tool-askQuery");
    const latest = calls.at(-1) as { input?: { purpose?: string } } | undefined;
    return latest?.input?.purpose ?? t("thinking");
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-medium text-foreground">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
          </Card>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "self-end max-w-[85%]" : "max-w-[85%]"}
          >
            <Card className={m.role === "user" ? "bg-muted p-3" : "p-4"}>
              {m.parts
                .filter((p) => p.type === "text")
                .map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap text-sm">
                    {"text" in p ? p.text : null}
                  </p>
                ))}
            </Card>
          </div>
        ))}

        {narration ? (
          <p className="animate-pulse text-sm text-muted-foreground" aria-live="polite">
            {narration}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">
            {/* An aborted stream is the 15s budget expiring, which has its own
                actionable copy; anything else is a real failure. */}
            {error.name === "AbortError" ? t("timeout") : t("error")}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={warm}
          placeholder={t("placeholder")}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
    </div>
  );
}
