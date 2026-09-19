"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, CircleHelp, LogOut, Tag, Trash2 } from "lucide-react";
import {
  deleteAccount,
  setPayCycle,
  updateBaseCurrency,
  updateDisplayName,
} from "@/app/(app)/settings/actions";
import type { CurrencyRow } from "@/lib/accounts/queries";
import {
  PAY_CYCLE_VALUES,
  SEMIMONTHLY_MAX_ANCHOR,
  semimonthlyStarts,
  type PayCycle,
} from "@/lib/period/cycle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallAppRow } from "@/components/pwa/install-app-row";
import { Row } from "@/components/settings/row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiSound } from "@/components/sound/sound-provider";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Translation key per cycle, for both the segmented control and its help
 *  text — kept next to each other so a new cycle value can't add one and
 *  forget the other. */
const PAY_CYCLE_LABEL_KEY: Record<PayCycle, string> = {
  monthly: "payCycleMonthly",
  semimonthly: "payCycleSemimonthly",
  weekly: "payCycleWeekly",
};
const PAY_CYCLE_HELP_KEY: Record<PayCycle, string> = {
  monthly: "payCycleHelpMonthly",
  semimonthly: "payCycleHelpSemimonthly",
  weekly: "payCycleHelpWeekly",
};

/** ISO weekday order (Monday = 1 … Sunday = 7), matching `isoWeekday` in
 *  lib/period/cycle.ts — the weekly anchor picker's values must agree with
 *  what that module expects. */
const WEEKDAY_KEYS: Record<number, string> = {
  1: "weekdayMonday",
  2: "weekdayTuesday",
  3: "weekdayWednesday",
  4: "weekdayThursday",
  5: "weekdayFriday",
  6: "weekdaySaturday",
  7: "weekdaySunday",
};
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function SettingsPanel({
  email,
  displayName,
  baseCurrency,
  currencies,
  payCycle,
  payAnchorDay,
}: {
  email: string;
  displayName: string;
  baseCurrency: string;
  currencies: CurrencyRow[];
  payCycle: PayCycle;
  payAnchorDay: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(baseCurrency);
  const [name, setName] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [namePending, startNameTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cycle, setCycle] = useState<PayCycle>(payCycle);
  // Each cycle keeps its own remembered anchor so switching away and back
  // (monthly -> quincenal -> monthly) restores what the user last picked
  // instead of resetting to day 1 / Monday.
  const [monthlyAnchor, setMonthlyAnchor] = useState(
    payCycle === "monthly" && payAnchorDay ? payAnchorDay : 1,
  );
  const [weeklyAnchor, setWeeklyAnchor] = useState(
    payCycle === "weekly" && payAnchorDay ? payAnchorDay : 1,
  );
  const [semimonthlyAnchor, setSemimonthlyAnchor] = useState(
    payCycle === "semimonthly" && payAnchorDay ? payAnchorDay : 1,
  );
  const [payCyclePending, startPayCycleTransition] = useTransition();
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const { enabled, setEnabled, playSuccess, playError } = useUiSound();

  const nameDirty = name.trim() !== savedName.trim();

  const monthlyAnchorItems: Record<string, string> = Object.fromEntries(
    MONTH_DAYS.map((day) => [String(day), t("payCycleDayOption", { day })]),
  );
  const weeklyAnchorItems: Record<string, string> = Object.fromEntries(
    WEEKDAYS.map((day) => [String(day), t(WEEKDAY_KEYS[day])]),
  );
  const [semiFirst, semiSecond] = semimonthlyStarts(semimonthlyAnchor);
  // What is typed, kept apart from the saved anchor so a half-typed "1" on the
  // way to "15" is not saved.
  const [semimonthlyDraft, setSemimonthlyDraft] = useState(String(semimonthlyAnchor));

  function savePayCycle(nextCycle: PayCycle, anchors: Record<PayCycle, number>) {
    const anchorDay = anchors[nextCycle];
    startPayCycleTransition(async () => {
      const result = await setPayCycle({ cycle: nextCycle, anchorDay });
      if (result.error) {
        toast.error(result.error);
        playError();
        // Revert to the last value the server actually holds, same as the
        // currency select below.
        setCycle(payCycle);
        setMonthlyAnchor(payCycle === "monthly" && payAnchorDay ? payAnchorDay : 1);
        setWeeklyAnchor(payCycle === "weekly" && payAnchorDay ? payAnchorDay : 1);
        const savedSemimonthly = payCycle === "semimonthly" && payAnchorDay ? payAnchorDay : 1;
        setSemimonthlyAnchor(savedSemimonthly);
        setSemimonthlyDraft(String(savedSemimonthly));
        return;
      }
      toast.success(t("toastPayCycleUpdated"));
      playSuccess();
      router.refresh();
    });
  }

  const anchors: Record<PayCycle, number> = {
    monthly: monthlyAnchor,
    weekly: weeklyAnchor,
    semimonthly: semimonthlyAnchor,
  };

  function onCycle(next: PayCycle) {
    if (next === cycle) return;
    setCycle(next);
    savePayCycle(next, anchors);
  }

  function onMonthlyAnchor(day: number) {
    setMonthlyAnchor(day);
    savePayCycle(cycle, { ...anchors, monthly: day });
  }

  function onWeeklyAnchor(day: number) {
    setWeeklyAnchor(day);
    savePayCycle(cycle, { ...anchors, weekly: day });
  }

  /** Saves on blur or Enter. Anything outside 1..15 snaps back to the saved day. */
  function commitSemimonthlyDraft() {
    const day = Number(semimonthlyDraft);
    if (!Number.isInteger(day) || day < 1 || day > SEMIMONTHLY_MAX_ANCHOR) {
      setSemimonthlyDraft(String(semimonthlyAnchor));
      return;
    }
    if (day === semimonthlyAnchor) return;
    setSemimonthlyAnchor(day);
    savePayCycle(cycle, { ...anchors, semimonthly: day });
  }

  /* Without `items`, Base UI's `<Select.Value>` shows the raw value, so the
     closed trigger read "USD" instead of "USD · US Dollar". */
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  function onSaveName() {
    if (!nameDirty) return;
    const next = name.trim();
    startNameTransition(async () => {
      const result = await updateDisplayName(next);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      setSavedName(next);
      setName(next);
      toast.success(t("toastDisplayNameUpdated"));
      playSuccess();
      router.refresh();
    });
  }

  function onCurrency(code: string) {
    setCurrency(code);
    startTransition(async () => {
      const result = await updateBaseCurrency(code);
      if (result.error) {
        toast.error(result.error);
        playError();
        setCurrency(baseCurrency);
      } else {
        toast.success(t("toastCurrencyUpdated"));
        playSuccess();
        router.refresh();
      }
    });
  }

  function onDeleteAccount() {
    startDeleteTransition(async () => {
      const result = await deleteAccount();
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      // The account and its session are gone — a hard navigation clears all
      // client state instead of letting the router refetch data for a user
      // that no longer exists.
      window.location.assign("/login");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="divide-y gap-0 px-6 py-0">
        <Row
          index={0}
          htmlFor="display-name"
          title={t("displayNameTitle")}
          description={t("displayNameDescription")}
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveName();
            }}
          >
            <Input
              id="display-name"
              value={name}
              maxLength={40}
              autoComplete="name"
              disabled={namePending}
              placeholder={t("displayNamePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              className="w-48"
            />
            {/* The save button only exists once there's something to save, so
                the row stays quiet at rest. */}
            <Button
              type="submit"
              size="sm"
              disabled={!nameDirty || namePending}
              isLoading={namePending}
              className={cn(
                "transition-all duration-200",
                nameDirty
                  ? "scale-100 opacity-100"
                  : "pointer-events-none w-0 scale-90 overflow-hidden px-0 opacity-0",
              )}
            >
              <Check className="size-4" />
              {t("saveButton")}
            </Button>
          </form>
        </Row>

        <Row index={1} title={t("signedInAsTitle")} description={t("signedInAsDescription")}>
          <span className="text-sm text-muted-foreground">{email || "—"}</span>
        </Row>

        <Row
          index={2}
          title={t("baseCurrencyTitle")}
          description={t("baseCurrencyDescription")}
        >
          <Select
            value={currency}
            onValueChange={(v) => onCurrency(v ?? baseCurrency)}
            disabled={pending}
            items={currencyItems}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row index={3} title={t("payCycleTitle")} description={t("payCycleDescription")}>
          <div className="flex flex-col items-end gap-2">
            <Tabs value={cycle} onValueChange={(v) => onCycle(v as PayCycle)}>
              <TabsList>
                {PAY_CYCLE_VALUES.map((c) => (
                  <TabsTrigger key={c} value={c} disabled={payCyclePending}>
                    {t(PAY_CYCLE_LABEL_KEY[c])}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {cycle === "monthly" && (
              <Select
                value={String(monthlyAnchor)}
                onValueChange={(v) => onMonthlyAnchor(Number(v ?? monthlyAnchor))}
                disabled={payCyclePending}
                items={monthlyAnchorItems}
              >
                <SelectTrigger size="sm" className="w-28" aria-label={t("payCycleAnchorDayLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_DAYS.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {t("payCycleDayOption", { day })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {cycle === "semimonthly" && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="pay-semimonthly-day"
                  className="text-xs font-normal text-muted-foreground"
                >
                  {t("payCycleSemimonthlyAnchorLabel")}
                </Label>
                <Input
                  id="pay-semimonthly-day"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={SEMIMONTHLY_MAX_ANCHOR}
                  className="h-8 w-16"
                  value={semimonthlyDraft}
                  disabled={payCyclePending}
                  onChange={(e) => setSemimonthlyDraft(e.target.value)}
                  onBlur={commitSemimonthlyDraft}
                  onKeyDown={(e) => e.key === "Enter" && commitSemimonthlyDraft()}
                />
              </div>
            )}

            {cycle === "weekly" && (
              <Select
                value={String(weeklyAnchor)}
                onValueChange={(v) => onWeeklyAnchor(Number(v ?? weeklyAnchor))}
                disabled={payCyclePending}
                items={weeklyAnchorItems}
              >
                <SelectTrigger
                  size="sm"
                  className="w-28"
                  aria-label={t("payCycleAnchorWeekdayLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {t(WEEKDAY_KEYS[day])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-right text-xs text-muted-foreground">
              {t(PAY_CYCLE_HELP_KEY[cycle], { first: semiFirst, second: semiSecond })}
            </p>
          </div>
        </Row>

        <Row index={4} title={t("themeTitle")} description={t("themeDescription")}>
          <ThemeToggle />
        </Row>

        <Row index={5} title={t("languageTitle")} description={t("languageDescription")}>
          <LanguageSwitcher />
        </Row>

        <Row
          index={6}
          title={t("soundEffectsTitle")}
          description={t("soundEffectsDescription")}
        >
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label={t("soundEffectsTitle")}
          />
        </Row>

        <InstallAppRow index={7} />

        <Row index={8} title={t("helpTitle")} description={t("helpDescription")}>
          <Button variant="outline" size="sm" render={<a href="/help" />} nativeButton={false}>
            <CircleHelp className="size-4" />
            {t("helpButton")}
          </Button>
        </Row>

        <Row index={9} title={t("rulesTitle")} description={t("rulesDescription")}>
          <Button
            variant="outline"
            size="sm"
            render={<a href="/settings/rules" />}
            nativeButton={false}
          >
            <Tag className="size-4" />
            {t("rulesLink")}
          </Button>
        </Row>

        <Row index={10} title={t("sessionTitle")} description={t("sessionDescription")}>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" />
              {t("signOutButton")}
            </Button>
          </form>
        </Row>
      </Card>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 dark:bg-destructive/10">
        <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-destructive">{t("dangerZoneTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("deleteAccountDescription")}</p>
          </div>
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm" className="shrink-0">
                  <Trash2 className="size-4" />
                  {t("deleteAccountButton")}
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
                <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deletePending}
                >
                  {tc("cancel")}
                </Button>
                <Button variant="destructive" onClick={onDeleteAccount} disabled={deletePending} isLoading={deletePending}>
                  {deletePending ? t("deleting") : t("deleteAccountButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
