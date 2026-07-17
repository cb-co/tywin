"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddDialog() {
  const { open, setOpen } = useQuickAdd();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Transaction forms arrive in Phase 4.
        </p>
      </DialogContent>
    </Dialog>
  );
}
