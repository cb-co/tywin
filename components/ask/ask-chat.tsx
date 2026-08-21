"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { AskAnswer } from "@/components/ask/ask-answer";

/**
 * One transport, built once.
 *
 * AI SDK v7 dropped the top-level `api` option from useChat — it now lives on
 * the transport (see ai/dist/index.d.ts: ChatInit has no `api` field,
 * HttpChatTransportInitOptions does). Constructed at module scope rather than in
 * the component body because the body runs on every render, and this component
 * re-renders on every keystroke: the input is state. A fresh transport per
 * keypress is a new object handed to useChat mid-conversation for a
 * configuration that never changes.
 */
const ASK_TRANSPORT = new DefaultChatTransport({ api: "/api/ask" });

export function AskChat({ initialQuestion }: { initialQuestion: string | null }) {
  const t = useTranslations("Ask");
  const [input, setInput] = useState("");
  const warmed = useRef(false);
  const sending = useRef(false);
  /* React invokes effects twice in development, and the cleanup runs between
     the two passes — so a guard that lives anywhere but a ref sends the
     question twice and pays for two answers. Same trap, same fix, as
     components/overview/recommendation-card.tsx. */
  const asked = useRef(false);
  const { messages, sendMessage, status, error } = useChat({ transport: ASK_TRANSPORT });

  /* Pays the cold start while they are still reading the page. A GET to the
     SAME route, not a neighbouring one: each route handler is its own function
     instance, so /api/ask/warm used to warm a process that would never serve
     the question. See the GET handler in app/api/ask/route.ts. */
  function warm() {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/ask", { method: "GET" }).catch(() => {});
  }
  useEffect(warm, []);

  const busy = status === "submitted" || status === "streaming";

  /* Cleared once the turn has actually finished, whether it answered or failed:
     a submit that errored must not lock the box. */
  useEffect(() => {
    if (!busy) sending.current = false;
  }, [busy]);

  /* A question typed on Overview arrives in the URL and is asked on landing, so
     the two screens read as one gesture rather than a handoff that makes you
     retype. Once per mount: a resend on every render would be a bill. */
  useEffect(() => {
    if (!initialQuestion || asked.current) return;
    asked.current = true;
    sendMessage({ text: initialQuestion });
  }, [initialQuestion, sendMessage]);

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

        {messages.map((m) => {
          const text = m.parts.filter((p) => p.type === "text");
          const wordless = m.role === "assistant" && text.length === 0;

          /* Joined, not rendered part by part. A model that emits its answer as
             two text parts splits a list down the middle, and each half parsed
             on its own loses the numbering and the table header. Blank line
             between them because that is the block separator in markdown. */
          const body = text.map((p) => ("text" in p ? p.text : "")).join("\n\n");

          /* While the model is still querying, its message exists but holds
             only tool parts. There is nothing to put in a bubble yet, and an
             empty one reads as a broken reply — the narration line below is
             what covers this moment. */
          if (wordless && busy) return null;

          /* Once the stream has ENDED wordless, the loop ran out of steps.
             Say so: an empty bubble reads as the app having lost the answer. */
          const silent = wordless && !busy;

          return (
            /* A question is short and reads as an aside, so it stays narrow and
               right-aligned. An answer can be a month of transactions, and
               capping it at the same width wrapped merchant names for no
               reason — it gets the whole column. */
            <div key={m.id} className={m.role === "user" ? "max-w-[85%] self-end" : "w-full"}>
              <Card className={m.role === "user" ? "bg-muted p-3" : "p-4"}>
                {silent ? (
                  <p className="text-sm text-muted-foreground">{t("noAnswer")}</p>
                ) : m.role === "user" ? (
                  /* Their own words, shown as typed. Markdown here would let a
                     stray asterisk in a question restyle it. */
                  <p className="whitespace-pre-wrap text-sm">{body}</p>
                ) : (
                  <AskAnswer text={body} />
                )}
              </Card>
            </div>
          );
        })}

        {narration ? (
          <p
            className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none"
            aria-live="polite"
          >
            {narration}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {/* The route maps an aborted stream to ASK_TIMEOUT (see its
                onError). Reading `error.name` here never worked: by the time a
                server-side abort has crossed the stream it is an ordinary
                Error carrying that text, not an AbortError. */}
            {error.message.includes("ASK_TIMEOUT") ? t("timeout") : t("error")}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          /* `busy` comes from `status`, which updates a render later — so two
             fast returns both read false and both send. The ref closes that
             window synchronously; the effect above reopens it when the turn
             finishes. */
          if (!input.trim() || busy || sending.current) return;
          sending.current = true;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        {/* A placeholder is not a label: it is gone the moment anyone types, and
            a screen reader announcing it is not required to. */}
        <label className="sr-only" htmlFor="ask-input">
          {t("inputLabel")}
        </label>
        <input
          id="ask-input"
          name="question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={warm}
          placeholder={t("placeholder")}
          autoComplete="off"
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
