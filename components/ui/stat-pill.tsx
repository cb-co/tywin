import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/12 text-destructive",
  warning: "bg-warning/12 text-warning",
  brand: "bg-brand/12 text-brand",
  neutral: "bg-muted text-muted-foreground",
} as const;

/** A small rounded chip for a delta or share, e.g. "▲ +8%" or "61%". */
export function StatPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
