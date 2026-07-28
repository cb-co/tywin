"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
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

// The first seven categorical series, literal rather than `var(--chart-n)`
// because a category colour is stored on the row and has to survive a theme
// switch. Keep in step with the light-mode `--chart-*` values in globals.css.
const SWATCHES = ["#3e5fad", "#b6770b", "#008f7d", "#be563d", "#8949a3", "#7e903e", "#1b8abd"];

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
  const { playSuccess, playError } = useUiSound();
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
        playError();
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      playSuccess();
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
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
