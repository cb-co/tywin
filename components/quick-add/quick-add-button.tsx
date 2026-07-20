"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  return (
    <Button
      onClick={() => setOpen(true)}
      size="icon"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 ring-1 ring-primary/20 transition-transform hover:scale-105 md:bottom-6"
      aria-label={t("title")}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
