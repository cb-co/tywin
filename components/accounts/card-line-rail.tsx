import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CardGroupLine } from "@/lib/accounts/group-lines";
import { cn } from "@/lib/utils";

const SEGMENT = "flex-1 truncate px-3 py-2 text-center text-xs transition-colors";

/**
 * The currency lines of this card, as a segmented control beneath its face.
 *
 * Navigating between the lines of one physical card used to mean going back to
 * the accounts grid and coming in again through the other line — a round trip
 * out of the card to reach a different view of the same card. The strip is that
 * trip collapsed to one click, and it does a second job on the way: it states
 * that the account you are looking at is one of several on a shared piece of
 * plastic, which the detail page otherwise never said.
 *
 * It is sized to the face and sits directly under it, so the claim it makes is
 * anchored to the object it is about — this card, these lines.
 *
 * It carries NO figures. An earlier version put each line's balance in the
 * segment, which read as three competing statements of what the card owes while
 * the hero beside it was already stating the real one at full size. A switcher
 * only has to answer "which line am I on, and what else is there"; the figures
 * live on the page each segment leads to.
 *
 * NOTHING renders below two lines. A single-line group has no sibling to offer
 * and no ambiguity to resolve, so a lone segment would be a switch with one
 * position; the breadcrumb above already names the group for that case.
 */
export function CardLineRail({ lines }: { lines: CardGroupLine[] }) {
  const t = useTranslations("AccountDetail");
  if (lines.length < 2) return null;

  return (
    /* One rounded, hairline-divided track rather than separate pills: the
       segments are positions on a single control, and drawing them as a run of
       detached boxes made the block read as a form sitting under the card. */
    <nav
      aria-label={t("cardLinesLabel")}
      className="mt-3 flex overflow-hidden rounded-lg border divide-x"
    >
      {lines.map((line) =>
        line.isCurrent ? (
          <span
            key={line.id}
            aria-current="page"
            className={cn(SEGMENT, "bg-muted font-medium text-foreground")}
          >
            {line.label}
          </span>
        ) : (
          <Link
            key={line.id}
            href={`/accounts/${line.id}`}
            className={cn(SEGMENT, "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            {line.label}
          </Link>
        ),
      )}
    </nav>
  );
}
