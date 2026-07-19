"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createCategory, updateCategory } from "@/app/(app)/budgets/actions";
import type { BudgetRow } from "@/lib/budgets/queries";
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

type Values = { name: string; emoji: string };

const SWATCHES = ["#0f7a54", "#d8a13a", "#2a9d8f", "#c86b4a", "#7b5ea7", "#3e7cb1", "#c25c7a"];

export function CategoryDialog({
  mode = "create",
  category,
  trigger,
}: {
  mode?: "create" | "edit";
  category?: BudgetRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(category?.color ?? SWATCHES[0]);
  const router = useRouter();
  const t = useTranslations("CategoryDialog");
  const tc = useTranslations("Common");
  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: category?.name ?? "", emoji: category?.emoji ?? "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: category?.name ?? "", emoji: category?.emoji ?? "" });
      setColor(category?.color ?? SWATCHES[0]);
    }
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && category
          ? await updateCategory(category.category_id, payload)
          : await createCategory(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? t("editTitle") : t("addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16 space-y-2">
              <Label htmlFor="emoji">{t("emojiLabel")}</Label>
              <Input id="emoji" placeholder="🍔" className="text-center" {...register("emoji")} />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("colorLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={t("colorSwatchAria", { color: c })}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all data-[active=true]:ring-2 data-[active=true]:ring-ring"
                  data-active={color === c}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
