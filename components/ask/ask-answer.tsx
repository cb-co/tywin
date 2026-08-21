"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { closeOpenMarkdown } from "@/lib/ask/markdown";

/**
 * Renders one answer's markdown.
 *
 * The model was always writing markdown — bold figures, a bullet per date, the
 * occasional table — and the bubble was a single paragraph with pre-wrapped
 * whitespace, so every delimiter reached the screen as a character. A date
 * breakdown arrived as "- **Aug 8:**" and read as noise around the numbers.
 *
 * The element map is explicit rather than a typography plugin. The plugin is not
 * a dependency of this project and adding it would put a second type scale
 * inside a visual system the audit asks to be left alone (UX-14). Every element
 * below is styled from the tokens the rest of the app already uses.
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,

  /* The figure class carries tabular and lining numerals (app/globals.css), so
     the emphasised amount a sentence leads with is also the one that lines up
     against the amounts under it. */
  strong: ({ children }) => (
    <strong className="figure font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,

  /* Markers and a hanging indent, so a merchant name long enough to wrap does
     not read as the start of the next entry. */
  ul: ({ children }) => (
    <ul className="list-outside list-disc space-y-1 pl-5 text-sm leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-outside list-decimal space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,

  /* A sixteen-row month of transactions is wider than a phone. The table scrolls
     inside its own box rather than pushing the conversation sideways. */
  table: ({ children }) => (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/60">{children}</tbody>,

  /* style is spread through on both cell types because that is where GFM column
     alignment arrives — a right-aligned amount column is the whole reason a
     table beats a sentence with the figures in brackets. Every cell gets
     tabular numerals: it changes nothing for words and aligns every digit. */
  th: ({ children, style }) => (
    <th style={style} className="figure px-2 py-1.5 text-left font-medium text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="figure px-2 py-1.5 align-top">
      {children}
    </td>
  ),

  /* Nothing in a person's transaction history is a URL, so a link here is
     something the model invented. Kept as its own text, dropped as a target. */
  a: ({ children }) => <span>{children}</span>,
  img: () => null,

  /* The prompt forbids discussing SQL or tables, so these are a fallback for a
     model that does it anyway — legible, and never wide enough to break out. */
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{children}</pre>
  ),

  /* An answer is not a document. Any heading the model reaches for is rendered
     at the weight of a strong line, so it cannot introduce a competing scale. */
  h1: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h2: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h3: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h4: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h5: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h6: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,

  hr: () => <hr className="border-border/60" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">{children}</blockquote>
  ),
};

export function AskAnswer({ text }: { text: string }) {
  return (
    /* Gaps between blocks live here rather than as margins on each element, so
       a paragraph followed by a list is spaced once and the last block never
       leaves a trailing gap inside the bubble. */
    <div className="flex flex-col gap-3 text-foreground">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {closeOpenMarkdown(text)}
      </Markdown>
    </div>
  );
}
