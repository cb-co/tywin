"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { createGoal, updateGoal } from "@/app/(app)/budgets/goal-actions";
import { SWATCHES } from "@/lib/palette";
import type { GoalCardRow } from "@/lib/goals/queries";
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

type Values = { name: string; emoji: string; target_amount: string; target_date: string };

export function GoalDialog({
  mode = "create",
  goal,
  trigger,
}: {
  mode?: "create" | "edit";
  goal?: GoalCardRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(goal?.color ?? SWATCHES[0]);
  const router = useRouter();
  const t = useTranslations("GoalDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const defaults = (): Values => ({
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? "",
    target_amount: goal ? String(goal.target_amount) : "",
    target_date: goal?.target_date ?? "",
  });

  const { register, handleSubmit, reset } = useForm<Values>({ defaultValues: defaults() });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults());
      setColor(goal?.color ?? SWATCHES[0]);
    }
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && goal
          ? await updateGoal(goal.id, payload)
          : await createGoal(payload);
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
              <Label htmlFor="goal-emoji">{t("emojiLabel")}</Label>
              <Input id="goal-emoji" placeholder="🏝️" className="text-center" {...register("emoji")} />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="goal-name">{t("nameLabel")}</Label>
              <Input
                id="goal-name"
                placeholder={t("namePlaceholder")}
                required
                {...register("name")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">{t("targetLabel")}</Label>
            <Input
              id="goal-target"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="tabular-nums"
              {...register("target_amount")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">{t("targetDateLabel")}</Label>
            <Input id="goal-date" type="date" {...register("target_date")} />
            <p className="text-xs text-muted-foreground">{t("targetDateHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("colorLabel")}</Label>
            <div className="grid grid-cols-8 gap-2">
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
