"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCategory } from "@/app/(app)/budgets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Values = { name: string; emoji: string; color: string };

const SWATCHES = ["#0f7a54", "#d8a13a", "#2a9d8f", "#c86b4a", "#7b5ea7", "#3e7cb1", "#c25c7a"];

export function CategoryDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(SWATCHES[0]);
  const router = useRouter();
  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: "", emoji: "", color: SWATCHES[0] },
  });

  function onSubmit(values: Values) {
    startTransition(async () => {
      const result = await createCategory({ ...values, color });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Category added");
      reset();
      setColor(SWATCHES[0]);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">New category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16 space-y-2">
              <Label htmlFor="emoji">Emoji</Label>
              <Input id="emoji" placeholder="🍔" className="text-center" {...register("emoji")} />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Dining out" {...register("name")} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all data-[active=true]:ring-2 data-[active=true]:ring-ring"
                  data-active={color === c}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
