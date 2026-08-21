import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AskAnswer } from "./ask-answer";

const html = (text: string) => renderToStaticMarkup(<AskAnswer text={text} />);

/* The answer that started this, copied from a real screenshot of the bubble.
   Every asterisk and dash below reached the screen as a character. */
const REAL_ANSWER = `Between August 8th and August 14th, 2026, there were 16 transactions on your Amex totalling **$464.08**:

- **Aug 8:** Pull & Bear Agora Mall ($54.48)
- **Aug 11:** Credito por Promocion (-$1.42), Seattle Airport Marriott ($237.12)`;

describe("AskAnswer", () => {
  it("renders the markdown the model was already writing", () => {
    const out = html(REAL_ANSWER);
    expect(out).toContain("<strong");
    expect(out).toContain("$464.08");
    expect(out).toContain("<li");
  });

  /* The regression itself, stated the way the user saw it: syntax on screen. */
  it("leaves no bold or bullet syntax in the output", () => {
    const out = html(REAL_ANSWER);
    expect(out).not.toContain("**");
    expect(out).not.toMatch(/>\s*-\s+\*\*/);
  });

  it("gives the emphasised figure the app's numeral styling", () => {
    expect(html("You spent **$464.08** in total.")).toMatch(/<strong class="[^"]*figure/);
  });

  it("keeps a literal asterisk from a merchant descriptor as text", () => {
    const out = html("- Aug 9: TST* Kedai Makan Capitol ($35.22)");
    expect(out).toContain("TST* Kedai Makan Capitol");
    expect(out).not.toContain("<em");
  });

  it("renders a table, and carries GFM column alignment onto the cells", () => {
    const out = html(
      ["| Fecha | Comercio | Monto |", "| :--- | :--- | ---: |", "| Aug 9 | 7-Eleven | $4.18 |"].join(
        "\n",
      ),
    );
    expect(out).toContain("<table");
    expect(out).toContain("overflow-x-auto");
    expect(out).toMatch(/text-align:\s*right/);
  });

  /* Nothing in a transaction history is a URL, so a link is the model inventing
     one. The words survive; the destination does not. */
  it("strips a link to its text", () => {
    const out = html("See [Banco Popular](https://example.com) for details.");
    expect(out).toContain("Banco Popular");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("example.com");
  });

  it("renders a bold run that is still streaming, without showing its syntax", () => {
    const out = html("You spent **$464");
    expect(out).toContain("<strong");
    expect(out).not.toContain("**");
  });
});
