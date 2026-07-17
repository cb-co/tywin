"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  return (
    <Button
      onClick={() => setOpen(true)}
      size="icon"
      className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 ring-1 ring-primary/20 transition-transform hover:scale-105 md:bottom-6"
      aria-label="Quick add"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
