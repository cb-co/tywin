import { cn } from "@/lib/utils";
import { Guilloche } from "./guilloche";
import { Serial } from "./microprint";

/**
 * A screen's one banknote: the field the screen's main figure is printed on.
 * Violet or peso, never inverted by theme, never more than one per screen.
 * The line work is decoration (aria-hidden inside Guilloche); the label and
 * figure are the content.
 */
export function Note({
  tone = "violet",
  label,
  serial,
  action,
  ornament = true,
  className,
  children,
}: {
  tone?: "violet" | "peso";
  label: string;
  serial?: string;
  action?: React.ReactNode;
  ornament?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[6px] p-6 sm:p-7",
        tone === "violet" ? "bg-(--note) text-(--note-ink)" : "bg-(--peso) text-(--peso-ink)",
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
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[3px] border border-current opacity-30" />
      <p className="legend relative text-[11px] opacity-85">{label}</p>
      <div className="relative mt-2">{children}</div>
      {action ? <div className="relative mt-6 flex flex-wrap gap-3">{action}</div> : null}
      {serial ? <Serial value={serial} className="absolute right-4 top-3" /> : null}
    </section>
  );
}
