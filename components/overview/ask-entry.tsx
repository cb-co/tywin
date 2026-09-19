"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MAX_INITIAL_QUESTION } from "@/lib/ask/initial-question";

/**
 * The way onto /ask from the screen someone is already looking at.
 *
 * Sits under the coaching card because those two are the same idea at different
 * levels of nerve: one tells you the thing it noticed, the other answers
 * whatever you noticed yourself. It is also the only entry point Ask has on a
 * phone — the bottom bar is a deliberate five cells and a sixth would cost every
 * other tab width, so this carries mobile on its own, which is why it is a box
 * you can type in rather than a link you have to follow first.
 *
 * The question travels as `?q=` and /ask sends it on arrival. Typing the
 * question here and having it answered there is one gesture; a link that dumps
 * you in front of an empty box you have to retype into is two.
 */
export function AskEntry() {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [question, setQuestion] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = question.trim();
        /* Empty is not a failure: it means they want the page, not an answer
           to nothing. */
        router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask");
      }}
      className="flex items-center gap-3 border-b-2 border-(--rule) pb-2 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-current"
    >
      <label className="sr-only" htmlFor="overview-ask">
        {t("askLabel")}
      </label>
      <input
        id="overview-ask"
        name="q"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t("askPlaceholder")}
        maxLength={MAX_INITIAL_QUESTION}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" aria-label={t("askSubmit")} className="grid size-9 shrink-0 place-items-center text-foreground">
        <ArrowRight className="size-5" />
      </button>
    </form>
  );
}
