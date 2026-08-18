"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Upload } from "lucide-react";
import {
  parseStatement,
  confirmStatementImport,
  type StatementPreviewResult,
} from "@/app/(app)/accounts/statement-actions";
import { MAX_STATEMENT_BYTES } from "@/lib/statements/limits";
import { formatMoney, formatDate } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Preview = NonNullable<StatementPreviewResult["preview"]>;

export function StatementImportDialog({
  open,
  onOpenChange,
  accountId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pins the target card. Omitted, a later task resolves one. */
  accountId?: string;
  /** Fired after a successful import so the host can refresh. */
  onImported?: () => void;
}) {
  const t = useTranslations("Statements");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const { playSuccess, playError } = useUiSound();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordIncorrect, setPasswordIncorrect] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [excludeFromBudget, setExcludeFromBudget] = useState(true);
  const [parsedStatement, setParsedStatement] = useState<string | null>(null);

  // The dialog is only ever useful with a file in hand, so it reaches for the
  // OS picker the moment it opens empty — the ref guard keeps it from
  // reopening after the user cancels the picker or picks a file.
  const pickerOpenedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      pickerOpenedRef.current = false;
      return;
    }
    if (pickerOpenedRef.current || file || preview) return;
    pickerOpenedRef.current = true;
    fileRef.current?.click();
  }, [open, file, preview]);

  function resetForm() {
    setPreview(null);
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPasswordIncorrect(false);
    setParsedStatement(null);
    setMappings({});
    setExcludeFromBudget(true);
  }

  function buildFormData(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    if (accountId) fd.set("account_id", accountId);
    if (password) fd.set("password", password);
    return fd;
  }

  function onParse(f: File) {
    setParsedStatement(null);
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) {
        setNeedsPassword(true);
        setPasswordIncorrect(!!result.passwordIncorrect);
        if (result.passwordIncorrect) setPassword("");
        return;
      }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed"));
        playError();
        return;
      }
      setNeedsPassword(false);
      setPasswordIncorrect(false);
      setPreview(result.preview);
      setParsedStatement(result.parsedStatement ?? null);
      setMappings(
        Object.fromEntries(
          result.preview.sections
            .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
            .filter(([, v]) => v),
        ),
      );
    });
  }

  function onConfirm() {
    if (!preview || !parsedStatement) return;
    const fd = new FormData();
    if (accountId) fd.set("account_id", accountId);
    fd.set("file_name", preview.fileName);
    fd.set("parsed_statement", parsedStatement);
    fd.set("mappings", JSON.stringify(mappings));
    fd.set("exclude_from_budget", String(excludeFromBudget));
    startTransition(async () => {
      const result = await confirmStatementImport(fd);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("imported"));
      playSuccess();
      resetForm();
      onImported?.();
      onOpenChange(false);
    });
  }

  const allMapped = preview?.sections.every((s) => mappings[s.sectionKey]) ?? false;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A dismissed dialog starts over next time — otherwise it would reopen
        // onto a stale preview and skip the picker.
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* min-w-0: DialogContent's popup is a grid, and a grid item's automatic
            minimum size is its content, not zero. The mapping selects are
            whitespace-nowrap, so without this their min-content width would set
            the modal's width instead of being clamped by it. */}
        <div className="min-w-0 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!f) return;
              // Stopped here rather than server-side because Next rejects an
              // oversize server-action body while parsing it — the action never
              // runs, so it has no way to turn that into a toast.
              if (f.size > MAX_STATEMENT_BYTES) {
                toast.error(t("fileTooLarge", { limit: MAX_STATEMENT_BYTES / (1024 * 1024) }));
                playError();
                return;
              }
              setFile(f);
              setPassword("");
              setNeedsPassword(false);
              setPasswordIncorrect(false);
              setPreview(null);
              setParsedStatement(null);
              onParse(f);
            }}
          />

          {/* Fallback for a dismissed picker, and the way back after a parse
              failure — otherwise the dialog would sit there with nothing in it. */}
          {!preview && !needsPassword ? (
            <Button
              variant="outline"
              disabled={pending}
              isLoading={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 size-4" />
              {t("importButton")}
            </Button>
          ) : null}

          {needsPassword && file ? (
            <div className="space-y-2">
              <Label htmlFor="stmt-password">{t("passwordLabel")}</Label>
              <p className={cn("text-xs", passwordIncorrect ? "text-destructive" : "text-muted-foreground")}>
                {passwordIncorrect ? t("passwordIncorrect") : t("passwordHint")}
              </p>
              <div className="flex gap-2">
                <Input
                  id="stmt-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button variant="outline" disabled={pending || !password} isLoading={pending} onClick={() => onParse(file)}>
                  {t("retryButton")}
                </Button>
              </div>
            </div>
          ) : null}

          {preview ? (
            <div className="min-w-0 space-y-4">
              {preview.sections.map((s) => (
                <div key={s.sectionKey} className="min-w-0 rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {s.sectionKey} · {s.currency} · {formatDate(s.periodStart, locale)} →{" "}
                      {formatDate(s.periodEnd, locale)}
                    </p>
                    <p className="figure text-sm">
                      {formatMoney(Number(s.closingBalance), s.currency)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("sectionSummary", { lines: s.lineCount, payments: s.paymentCount })}
                  </p>
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs">{t("mapSectionLabel", { section: s.sectionKey })}</Label>
                    <Select
                      value={mappings[s.sectionKey] || "none"}
                      onValueChange={(v) =>
                        setMappings((m) => ({ ...m, [s.sectionKey]: v === "none" ? "" : (v ?? "") }))
                      }
                      items={{
                        none: t("mapSectionNone"),
                        ...Object.fromEntries(
                          preview.accountOptions.map((a) => [a.id, `${a.name} · ${a.currency}`]),
                        ),
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Clearing frees this section's claim so accounts can be
                            swapped between sections without a deadlock. */}
                        <SelectItem value="none">{t("mapSectionNone")}</SelectItem>
                        {preview.accountOptions
                          .filter(
                            (a) =>
                              a.currency === s.currency &&
                              (mappings[s.sectionKey] === a.id ||
                                !Object.entries(mappings).some(
                                  ([key, v]) => key !== s.sectionKey && v === a.id,
                                )),
                          )
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="flex flex-col">
                                <span>{a.name}</span>
                                <span className="text-xs text-muted-foreground">{a.currency}</span>
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <Label htmlFor="exclude_from_budget" className="font-normal text-muted-foreground">
                  {t("excludeFromBudgetLabel")}
                  <span className="ml-1.5 block text-xs">{t("excludeFromBudgetHint")}</span>
                </Label>
                <Switch
                  id="exclude_from_budget"
                  checked={excludeFromBudget}
                  onCheckedChange={setExcludeFromBudget}
                />
              </div>
              <div className="flex gap-2">
                <Button disabled={pending || !allMapped} isLoading={pending} onClick={onConfirm}>
                  {t("confirmButton")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  {t("cancelButton")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
