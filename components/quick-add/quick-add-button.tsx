"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  // Plain and lightly raised. This used to carry a `primary`-tinted shadow and
  // ring, which read as a halo around the button rather than as elevation —
  // and once `primary` became ivory, that halo turned into a glow in dark
  // mode. `--shadow-float` is neutral and tight to the element, so the fill
  // keeps the same solid ink as every other default button.
  return (
    <Button
      onClick={() => setOpen(true)}
      size="icon"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full shadow-(--shadow-float) transition-transform hover:scale-105 md:bottom-6"
      aria-label={t("title")}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
