import { cn } from "@/lib/utils";

/** Two thin ink rules with paper between them: the printed double rule that
 *  separates two ledgers. Decorative; the headings on either side carry the
 *  meaning. */
export function DoubleRule({ className }: { className?: string }) {
  return <hr aria-hidden className={cn("h-[5px] border-0 border-y border-(--rule) bg-transparent", className)} />;
}
