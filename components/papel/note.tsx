import { cn } from "@/lib/utils";
import { Guilloche } from "./guilloche";
import { Microprint, Serial } from "./microprint";

/**
 * A screen's one banknote: the field the screen's main figure is printed on.
 * Violet or peso, never inverted by theme, never more than one per screen.
 * The line work is decoration (aria-hidden inside Guilloche); the label and
 * figure are the content. On peso the figure's cents (drawn at 0.6 opacity by
 * MoneyDisplay) are lifted to 0.9 so real data clears 4.5:1 on that ink.
 */
export function Note({
  tone = "violet",
  label,
  serial,
  microprint,
  action,
  ornament = true,
  className,
  children,
}: {
  tone?: "violet" | "peso";
  label: string;
  serial?: string;
  /** Bilingual legend for the banknote's microprinted border; replaces the plain inner hairline. */
  microprint?: string;
  action?: React.ReactNode;
  ornament?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[6px] p-6 sm:p-7",
        tone === "violet" ? "bg-(--note) text-(--note-ink)" : "bg-(--peso) text-(--peso-ink) [--note-line:var(--peso-line)] [&_.figure>span]:opacity-90",
        className,
      )}
    >
      {ornament ? (
        <Guilloche
          variant="field"
          lineWidth={0.5}
          className="pointer-events-none absolute inset-0 -z-10 size-full opacity-25"
        />
      ) : null}
      {microprint ? (
        <Microprint text={microprint} />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[3px] border border-current opacity-30" />
      )}
      <p className={cn("legend relative text-[11px]", tone === "violet" && "opacity-85")}>{label}</p>
      <div className="relative mt-2">{children}</div>
      {action ? <div className="relative mt-6 flex flex-wrap gap-3">{action}</div> : null}
      {serial ? <Serial value={serial} className={microprint ? "absolute right-6 top-5" : "absolute right-4 top-3"} /> : null}
    </section>
  );
}
