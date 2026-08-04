import { cn } from "@/lib/utils";

/** The signature gradient slab. The one object that does not invert by theme. */
export function HeroCard({
  label,
  children,
  action,
  className,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-[image:var(--hero)] p-7 text-(--hero-foreground) shadow-(--shadow-card)",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-white/10 blur-2xl"
      />
      <p className="relative text-sm font-medium opacity-80">{label}</p>
      <div className="relative mt-2">{children}</div>
      {action ? <div className="relative mt-6 flex gap-3">{action}</div> : null}
    </div>
  );
}
