import { ProofMark } from "@/components/papel/proof-mark";
import { Mark } from "@/components/transactions/mark";
import type { BudgetStatus } from "@/lib/budgets/queries";

/** Budget state as a glyph or a tag, never a colour: nothing when within,
 *  an engraved tag when near, a flag proof mark when over. */
export function BudgetStatusMark({
  status,
  overLabel,
  nearLabel,
}: {
  status: BudgetStatus;
  overLabel: string;
  nearLabel: string;
}) {
  if (status === "over") return <ProofMark tone="flag" className="shrink-0">{overLabel}</ProofMark>;
  if (status === "approaching") return <Mark>{nearLabel}</Mark>;
  return null;
}
