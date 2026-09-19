"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  // The one violet seal on the shell: quick-add is the signature action.
  return (
    <Button
      onClick={() => setOpen(true)}
      variant="brand"
      size="icon"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 size-15 ring-2 ring-(--note-line) ring-offset-2 ring-offset-background transition-transform hover:scale-105 md:bottom-6"
      aria-label={t("title")}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
