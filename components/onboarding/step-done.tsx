"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote, CreditCard, HandCoins, Landmark, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { finishOnboarding } from "@/app/welcome/actions";
import { Button } from "@/components/ui/button";
import { StepFooter, StepHeading } from "./parts";
import { isMainAccount, type StepProps } from "./types";
import type { Step } from "@/lib/onboarding/resume";
import { semimonthlyStarts } from "@/lib/period/cycle";

/**
 * What the flow set up, one row per step, each with a way back to change it.
 * The rest of the app is gated until onboarding is stamped, so changes happen
 * here rather than through links into pages the user can't reach yet.
 */
export function StepDone({ data, onBack, goTo }: StepProps & { goTo: (step: Step) => void }) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const finishing = useRef(false);

  const cards = data.accounts.filter((a) => a.type === "credit_card");
  const cycleKey = {
    semimonthly: "doneCycleSemimonthly",
    monthly: "doneCycleMonthly",
    weekly: "doneCycleWeekly",
  } as const;
  const [first, second] = semimonthlyStarts(data.payAnchorDay);
  const cycle = t(cycleKey[data.payCycle as keyof typeof cycleKey] ?? "doneCycleMonthly", {
    first,
    second,
  });

  const rows: { step: Step; icon: LucideIcon; title: string; subtitle?: string }[] = [
    {
      step: "account",
      icon: Landmark,
      title: t("doneAccounts", { count: data.accounts.filter(isMainAccount).length }),
    },
    {
      step: "cards",
      icon: CreditCard,
      title: t("doneCards", { count: cards.length }),
      subtitle: cards.length
        ? t("doneCardsImported", { count: cards.filter((c) => c.imported).length })
        : undefined,
    },
    {
      step: "income",
      icon: Banknote,
      title: data.income?.name ?? t("doneIncomeNone"),
      subtitle: t("donePeriod", { cycle }),
    },
    { step: "loans", icon: HandCoins, title: t("doneLoans", { count: data.accounts.filter((a) => a.type === "loan").length }) },
    { step: "bills", icon: Receipt, title: t("doneBills", { count: data.bills.length }) },
  ];

  function finish() {
    if (finishing.current) return;
    finishing.current = true;
    startTransition(async () => {
      const done = await finishOnboarding();
      if (done.error) {
        finishing.current = false;
        toast.error(done.error);
        return;
      }
      toast.success(t("toastReady"));
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("doneTitle")} body={t("doneBody")} />
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map(({ step, icon: Icon, title, subtitle }) => (
            <li key={step} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{title}</p>
                {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
              </div>
              <Button size="sm" variant="ghost" onClick={() => goTo(step)}>
                {t("doneChange")}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <StepFooter
        onBack={onBack}
        primary={{ label: t("finishButton"), onClick: finish, pending }}
      />
    </>
  );
}
