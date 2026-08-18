"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Upload } from "lucide-react";
import {
  parseStatement,
  confirmStatementImport,
  listImportTargets,
  type ImportTarget,
  type StatementPreviewResult,
} from "@/app/(app)/accounts/statement-actions";
import { addCardLine } from "@/app/(app)/accounts/actions";
import { ImportCardStubStep } from "@/components/statements/import-card-stub-step";
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
  /** Pins the target card. Omitted, the dialog resolves one itself: it lists
   *  the user's cards, picks the only one, asks which of several, or offers to
   *  create the first. */
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

  /* The card this import lands on. `accountId` pins it (the card page); without
     one it is resolved from the user's own cards, and `targets` is the list
     those choices are made from — null until it has been fetched. */
  const [targetId, setTargetId] = useState<string | null>(accountId ?? null);
  const [targets, setTargets] = useState<ImportTarget[] | null>(null);

  // Fetched by the dialog rather than handed down, so an entry point can mount
  // it knowing nothing about the user's accounts. Only when no card is pinned:
  // the card page already knows its answer.
  useEffect(() => {
    if (!open || accountId || targets !== null) return;
    let cancelled = false;
    void listImportTargets().then((list) => {
      if (cancelled) return;
      setTargets(list);
      // One card is not a choice worth asking about.
      if (list.length === 1) setTargetId(list[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [open, accountId, targets]);

  // The dialog is only ever useful with a file in hand, so it reaches for the
  // OS picker the moment it opens empty — the latch keeps it from reopening
  // after the user cancels the picker or picks a file, and resets on close so
  // the next open starts at the picker again.
  const pickerOpenedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      pickerOpenedRef.current = false;
      return;
    }
    // Nothing to import onto yet: the user is still picking or creating a card,
    // and an OS picker over that step would be asking two questions at once.
    if (!targetId) return;
    if (pickerOpenedRef.current || file || preview) return;
    // Latch only once the click actually lands. The input is mounted outside
    // the dialog precisely so the ref is live here, but latching on a null ref
    // would be unrecoverable: the deps never change again, so the picker would
    // silently never open.
    const input = fileRef.current;
    if (!input) return;
    pickerOpenedRef.current = true;
    input.click();
  }, [open, file, preview, targetId]);

  function resetForm() {
    setPreview(null);
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPasswordIncorrect(false);
    setParsedStatement(null);
    setMappings({});
    setExcludeFromBudget(true);
    // Back to whatever the host pinned, so a second open — possibly from a
    // different card — never inherits the first one's target. `targets` is
    // dropped with it: a card created during this run belongs in the next list.
    setTargetId(accountId ?? null);
    setTargets(null);
  }

  function buildFormData(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    if (targetId) fd.set("account_id", targetId);
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
    if (targetId) fd.set("account_id", targetId);
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

  /* What to call a line added from here. The trailing " · USD" a grouped card's
     lines already carry is stripped first, so a second line is named
     "Visa Infinite · USD" and never "Visa Infinite · DOP · USD". */
  const cardName = (
    targets?.find((c) => c.id === targetId)?.name ??
    preview?.accountOptions[0]?.name ??
    ""
  ).replace(/\s·\s[A-Z]{3}$/, "");

  /**
   * The way out of a section no card of this user's can receive: `suggestAccountId`
   * matches by currency, so a DOP-only card faced with a USD section leaves that
   * section unmappable and Confirm permanently disabled.
   *
   * The new option is appended to the preview locally. Re-running `parseStatement`
   * to have the server rebuild `accountOptions` would re-extract the PDF and
   * re-call the LLM — there is no server-side parse cache; the parsed statement
   * the client holds is echoed back on *confirm*, which is a different call.
   *
   * Trusting the client here costs nothing: `confirmStatementImport` rebuilds its
   * own options from `loadAccountContext` and rejects any section mapped to an
   * account the user does not own or whose currency does not match, so a forged
   * option fails at confirm rather than importing anything anywhere.
   */
  function onAddLine(sectionKey: string, currency: string) {
    if (!targetId) return;
    const lineName = t("lineNameSuggestion", { card: cardName, currency });
    startTransition(async () => {
      const result = await addCardLine(targetId, { name: lineName, currency });
      const newId = result.id;
      if (!newId) {
        if (result.error) toast.error(result.error);
        playError();
        return;
      }
      setPreview((p) =>
        p ? { ...p, accountOptions: [...p.accountOptions, { id: newId, name: lineName, currency }] } : p,
      );
      setMappings((m) => ({ ...m, [sectionKey]: newId }));
      toast.success(t("lineAdded"));
      playSuccess();
    });
  }

  return (
    <>
      {/* Outside the dialog on purpose. DialogContent renders through a portal
          whose container is set in an effect, so the popup's children are not
          in the DOM yet when the open effect above runs — an input in there
          would leave the ref null exactly when the picker needs to open. Base
          UI only marks outside content aria-hidden (never inert), so a hidden
          input out here stays clickable while the modal is open. */}
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
            {/* Which card first, file second. Nothing is rendered while the list
                is still in flight — a spinner for one small query would flash. */}
            {!targetId && targets !== null ? (
              targets.length === 0 ? (
                <ImportCardStubStep
                  onCreated={setTargetId}
                  submitLabel={t("stubSubmit")}
                  /* No preference: the step falls back to the profile's base
                     currency, which it already fetches for its own list. */
                  defaultCurrency=""
                />
              ) : (
                <div className="min-w-0 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t("pickCardHeading")}</p>
                    <p className="text-xs text-muted-foreground">{t("pickCardHint")}</p>
                  </div>
                  <ul className="min-w-0 space-y-2">
                    {targets.map((c) => (
                      <li key={c.id} className="min-w-0">
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                          onClick={() => setTargetId(c.id)}
                        >
                          <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.last4 ? `•••• ${c.last4} · ` : ""}
                            {c.currency}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : null}

            {/* Fallback for a dismissed picker, and the way back after a parse
                failure — otherwise the dialog would sit there with nothing in it. */}
            {targetId && !preview && !needsPassword ? (
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
                {preview.sections.map((s) => {
                  /* No card of this user's is in the section's currency, so the
                     select below has nothing but "not assigned" to offer. */
                  const unmatched = !preview.accountOptions.some((a) => a.currency === s.currency);
                  return (
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
                      {unmatched ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {t("unmatchedSection", { currency: s.currency })}
                          </p>
                          <Button
                            variant="outline"
                            disabled={pending}
                            isLoading={pending}
                            onClick={() => onAddLine(s.sectionKey, s.currency)}
                          >
                            {t("addLineButton", { currency: s.currency })}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
    </>
  );
}
