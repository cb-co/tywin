import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

/**
 * Network marks for a card face.
 *
 * Drawn in-repo as vectors. Deliberately NOT fetched from anywhere and NOT
 * sourced from the card-art model: a URL a model invented is a broken image on
 * someone's card, and a logo CDN would put a third-party request on every
 * account page, leak which cards a person holds, and fall over behind the CSP.
 * These are seven fixed marks that change roughly never — a build-time asset,
 * not a runtime lookup. The model supplies the accent colour and the network
 * NAME; the drawing lives here.
 *
 * They are recognisable shorthand rather than pixel-accurate reproductions of
 * the brands' trademarks, and are used only to label a card the person already
 * owns.
 *
 * Everything is drawn in `currentColor` — the foreground measured against the
 * card's own fill — except Mastercard, whose two-circle mark is only readable
 * as Mastercard in its own colours. Those are its brand red and amber, which
 * hold up on any card fill because the shape carries the recognition even where
 * the hue is close to the background.
 *
 * `fill` is the card's resolved background colour, used to knock lettering out
 * of a solid mark. `--card` (an app surface token) has no relationship to that
 * user-data colour and can render invisibly against it.
 *
 * When the network can't be inferred, nothing renders: a placeholder chip would
 * imply a network the card doesn't have.
 */
export function NetworkMark({
  network,
  fill,
  className,
}: {
  network: CardNetwork | null;
  fill: string;
  className?: string;
}) {
  if (!network) return null;

  // Roughly a third taller than the wordmarks these replaced. On a real card
  // the network mark is the second thing you see after the colour, and at the
  // old size it read as a caption.
  const base = cn("h-8 w-auto", className);

  if (network === "mastercard") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Mastercard">
        <circle cx="19" cy="15" r="10.5" fill="#EB001B" />
        <circle cx="29" cy="15" r="10.5" fill="#F79E1B" />
        {/* The overlap is the mark. Rendering it as its own shape rather than
            leaning on alpha keeps it exact on any card colour. */}
        <path
          d="M24 6.6a10.5 10.5 0 0 0 0 16.8 10.5 10.5 0 0 0 0-16.8Z"
          fill="#FF5F00"
        />
      </svg>
    );
  }

  if (network === "visa") {
    // The wordmark's character is the forward lean and the flat, wide caps.
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Visa">
        <text
          x="24"
          y="21"
          textAnchor="middle"
          fill="currentColor"
          fontSize="17"
          fontWeight="700"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="0.5"
        >
          VISA
        </text>
      </svg>
    );
  }

  if (network === "amex") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="American Express">
        <rect x="2" y="3" width="44" height="24" rx="3" fill="currentColor" />
        <text
          x="24"
          y="13.4"
          textAnchor="middle"
          fill={fill}
          fontSize="7"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
          letterSpacing="0.2"
        >
          AMERICAN
        </text>
        <text
          x="24"
          y="22"
          textAnchor="middle"
          fill={fill}
          fontSize="7"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
          letterSpacing="0.2"
        >
          EXPRESS
        </text>
      </svg>
    );
  }

  if (network === "discover") {
    // The band with the orbit sitting in the descender is Discover's tell.
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Discover">
        <text
          x="21"
          y="20"
          textAnchor="middle"
          fill="currentColor"
          fontSize="11"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
          letterSpacing="-0.2"
        >
          DISCOVER
        </text>
        <circle cx="41" cy="16.5" r="4.5" fill="#F76B1C" />
      </svg>
    );
  }

  if (network === "diners") {
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="Diners Club">
        <circle cx="17" cy="15" r="9" fill="currentColor" />
        <circle cx="27" cy="15" r="9" fill="currentColor" opacity="0.55" />
        <text
          x="24"
          y="27.5"
          textAnchor="middle"
          fill="currentColor"
          fontSize="5.5"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
          letterSpacing="0.4"
        >
          DINERS
        </text>
      </svg>
    );
  }

  if (network === "jcb") {
    // Three stacked bars, the mark's actual structure, in its own three hues.
    return (
      <svg viewBox="0 0 48 30" className={base} role="img" aria-label="JCB">
        {[
          { x: 4, fill: "#0E4C96", label: "J" },
          { x: 17.3, fill: "#BE0026", label: "C" },
          { x: 30.6, fill: "#00A650", label: "B" },
        ].map((bar) => (
          <g key={bar.label}>
            <rect x={bar.x} y="4" width="13.3" height="22" rx="2.5" fill={bar.fill} />
            <text
              x={bar.x + 6.65}
              y="19"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="700"
              fontFamily="Helvetica, Arial, sans-serif"
            >
              {bar.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // unionpay
  return (
    <svg viewBox="0 0 48 30" className={base} role="img" aria-label="UnionPay">
      {[
        { x: 4, fill: "#E21836" },
        { x: 16, fill: "#00447C" },
        { x: 28, fill: "#007B84" },
      ].map((bar) => (
        // Slanted parallelograms, the mark's actual geometry.
        <path
          key={bar.x}
          d={`M${bar.x + 4} 4 H${bar.x + 16} L${bar.x + 12} 26 H${bar.x} Z`}
          fill={bar.fill}
        />
      ))}
    </svg>
  );
}
