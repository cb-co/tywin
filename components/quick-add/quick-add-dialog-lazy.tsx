"use client";

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { useQuickAdd } from "./quick-add-provider";
import type { QuickAddData } from "@/lib/transactions/queries";

/* TransactionForm pulls in react-hook-form + zod, which every authenticated
 * page was shipping upfront even though most visits never open Quick Add.
 * Deferring the import until the dialog has been opened once keeps that
 * weight out of the initial bundle for every route, including /help. */
const QuickAddDialog = dynamicImport(
  () => import("./quick-add-dialog").then((m) => m.QuickAddDialog),
  { ssr: false },
);

export function QuickAddDialogLazy({ data }: { data: QuickAddData }) {
  const { open } = useQuickAdd();
  // Adjusting state during render (not in an effect) per React's guidance
  // for deriving state from a prop change: https://react.dev/learn/you-might-not-need-an-effect
  const [prevOpen, setPrevOpen] = useState(open);
  const [everOpened, setEverOpened] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setEverOpened(true);
  }

  if (!everOpened) return null;
  return <QuickAddDialog data={data} />;
}
