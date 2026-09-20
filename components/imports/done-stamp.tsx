import { ProofMark } from "@/components/papel/proof-mark";
import { cn } from "@/lib/utils";

/** The large check printed across a finished sheet. `animate` is true only on
 *  the transition into done; arriving at an already-finished triage shows the
 *  mark still, with no motion and no sound. */
export function DoneStamp({ label, animate }: { label: string; animate: boolean }) {
  return (
    <div className={cn("-rotate-[4deg]", animate && "stamp-down")}>
      <ProofMark tone="ok" size="lg">
        {label}
      </ProofMark>
    </div>
  );
}
