import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CardFace, NETWORK_WORDMARK } from "./card-face";

const html = (props: Partial<React.ComponentProps<typeof CardFace>> = {}) =>
  renderToStaticMarkup(
    <CardFace name="BHD Visa Platinum" last4="4417" network="visa" accent="#e4b64a" {...props} />,
  );

describe("CardFace", () => {
  it("prints the drawn network logo in the app", () => {
    const out = html();
    expect(out).toContain("<svg");
    expect(out).not.toContain(NETWORK_WORDMARK.visa);
  });

  it("prints the wordmark when asked (marketing)", () => {
    expect(html({ mark: "wordmark" })).toContain(NETWORK_WORDMARK.visa);
  });

  it("renders no mark when the network is null", () => {
    const out = html({ network: null, mark: "wordmark" });
    expect(out).not.toContain(NETWORK_WORDMARK.visa);
    expect(out).not.toContain(NETWORK_WORDMARK.mastercard);
  });

  it("falls back to the default accent for an invalid or missing hex without throwing", () => {
    expect(() => html({ accent: "not-a-color" })).not.toThrow();
    expect(html({ accent: "not-a-color" })).toContain("BHD Visa Platinum");
  });

  it("masks a missing last4 as dots", () => {
    expect(html({ last4: null })).toContain("····");
  });
});
