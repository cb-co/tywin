import { Guilloche } from "./guilloche";
import { NetworkMark } from "./network-mark";
import { cardForeground, gradientFrom } from "@/lib/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@/lib/accounts/card-art";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

export const NETWORK_WORDMARK: Record<CardNetwork, string> = {
  visa: "VISA",
  mastercard: "MASTERCARD",
  amex: "AMEX",
};

/**
 * The one card face: the homepage's drawn card
 * (components/marketing/papel/papel.module.css:921-974), fed by the card's
 * own stored accent. Used by the marketing home page and every in-app card
 * (gallery, group tile, detail hero) so they match by construction.
 *
 * `name` is the card's own name (what the user typed), not the cardholder —
 * see the module doc comment above the plan task this was built from.
 */
export function CardFace({
  name,
  last4,
  network,
  accent,
  mark = "logo",
  className,
}: {
  name: string;
  last4: string | null;
  network: CardNetwork | null;
  accent: string | null;
  /** In-app faces print the drawn network logo; the marketing page keeps its wordmark. */
  mark?: "logo" | "wordmark";
  className?: string;
}) {
  const base = accent && HEX6.test(accent) ? accent : DEFAULT_CARD_ACCENT;
  const fg = cardForeground(base);
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[1.7] w-full max-w-[25rem] flex-col justify-between overflow-hidden rounded-[18px] px-[1.4rem] py-[1.3rem]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_26px_50px_-24px_rgb(20_10_40/0.7)]",
        className,
      )}
      style={{ backgroundImage: gradientFrom(base), color: fg }}
    >
      <Guilloche
        lineWidth={0.5}
        className="pointer-events-none absolute -right-[95%] -top-[75%] -z-10 aspect-square w-[150%] opacity-35"
      />
      <span className="truncate text-[1.1rem] font-extrabold [font-stretch:112%]">{name}</span>
      <span className="figure font-semibold tracking-[0.14em]">•••• {last4 ?? "····"}</span>
      {network ? (
        mark === "logo" ? (
          <NetworkMark
            network={network}
            foreground={fg}
            className="absolute bottom-[1.2rem] right-[1.4rem]"
          />
        ) : (
          <span className="absolute bottom-[1.2rem] right-[1.4rem] text-[0.95rem] font-black italic tracking-[0.04em] [font-stretch:125%]">
            {NETWORK_WORDMARK[network]}
          </span>
        )
      ) : null}
    </div>
  );
}
