import { ProofMark } from "@/components/papel/proof-mark";

const MARK = {
  success: "ok",
  destructive: "flag",
  warning: "neutral",
  brand: "neutral",
  neutral: "neutral",
} as const;

/** A small printed proof mark for a delta or share, e.g. "+8%" or "61%". */
export function StatPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof MARK;
  className?: string;
}) {
  return (
    <ProofMark tone={MARK[tone]} className={className}>
      <span className="tabular-nums">{children}</span>
    </ProofMark>
  );
}
