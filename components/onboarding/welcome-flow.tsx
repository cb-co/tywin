"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { updateDisplayName, updateBaseCurrency } from "@/app/(app)/settings/actions";
import { createAccount } from "@/app/(app)/accounts/actions";
import { finishOnboarding } from "@/app/welcome/actions";
import type { CurrencyRow } from "@/lib/accounts/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportCardStubStep } from "@/components/statements/import-card-stub-step";
import { StatementImportDialog } from "@/components/statements/statement-import-dialog";
import { cn } from "@/lib/utils";

/** Onboarding creates one plain balance account, and optionally one credit card.
 *  The card is a stub — name, currency, last 4 — because the three fields that made
 *  a card too heavy for this flow (limit, closing day, due day) are exactly the ones
 *  a statement backfills on first import. Loans still need principals and terms, so
 *  they stay one click away on the Accounts page. */
const STARTER_TYPES = ["checking", "savings", "cash", "investment"] as const;
type StarterType = (typeof STARTER_TYPES)[number];

const STEP_COUNT = 4;

export function WelcomeFlow({
  currencies,
  initialName,
  initialCurrency,
  email,
  stepLabels,
}: {
  currencies: CurrencyRow[];
  initialName: string;
  initialCurrency: string;
  email: string;
  stepLabels: string[];
}) {
  const t = useTranslations("Welcome");
  const tType = useTranslations("AccountTypes");
  // The card step reuses the import dialog's stub form, and its button
  // says the same thing there as here.
  const tStatements = useTranslations("Statements");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  // Seeded from the email local part so the field is never a blank stare.
  const [name, setName] = useState(initialName || (email.split("@")[0] ?? ""));
  const [currency, setCurrency] = useState(initialCurrency);

  const [acctType, setAcctType] = useState<StarterType>("checking");
  const [acctName, setAcctName] = useState("");
  const [acctCurrency, setAcctCurrency] = useState(initialCurrency);
  const [acctBalance, setAcctBalance] = useState("");

  // The card step's outcome. `importFor` holds the stub's id while its first
  // statement is being imported; onboarding ends when that dialog closes,
  // whether or not anything was imported.
  const [importFor, setImportFor] = useState<string | null>(null);
  // The dialog fires onImported and then closes, so without this both handlers
  // would finish onboarding — and the second call would land after the replace.
  const finishing = useRef(false);

  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  const canAdvance =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? currency.length === 3
        : step === 2
          ? acctName.trim().length > 0
          : // The card is optional, so skipping is a valid answer and the step
            // is always passable.
            true;

  /* Not available on the card step: the account behind it is already created,
     and walking back into that form would create a second one. */
  const canGoBack = step > 0 && step < STEP_COUNT - 1;

  function back() {
    if (canGoBack) setStep((s) => s - 1);
  }

  /* Each step commits as it is passed, so a refresh mid-flow resumes with the
     earlier answers already saved rather than starting over. */
  function next() {
    if (!canAdvance || pending) return;

    startTransition(async () => {
      if (step === 0) {
        const r = await updateDisplayName(name);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        setStep(1);
        return;
      }

      if (step === 1) {
        const r = await updateBaseCurrency(currency);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        setAcctCurrency((c) => (c === initialCurrency ? currency : c));
        setStep(2);
        return;
      }

      if (step === 2) {
        const created = await createAccount({
          name: acctName.trim(),
          type: acctType,
          currency: acctCurrency,
          starting_balance: Number(acctBalance || 0),
          transfer_tax_rate: 0.002,
          network_fee_amount: 0,
          network_fee_optional: true,
          current_balance: 0,
        });
        if (created.error) {
          toast.error(created.error);
          return;
        }
        setStep(3);
        return;
      }

      await finish();
    });
  }

  /* Ends onboarding from wherever the card step left off: skipped, card added,
     or card added and its first statement imported. */
  async function finish() {
    if (finishing.current) return;
    finishing.current = true;

    const done = await finishOnboarding();
    if (done.error) {
      finishing.current = false;
      toast.error(done.error);
      return;
    }

    toast.success(t("toastReady"));
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      {/* Progress. Segments fill as steps complete, so the end is always in
          sight and the flow reads as short. */}
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full bg-primary transition-transform duration-500 ease-out",
                i <= step ? "scale-x-100" : "scale-x-0",
              )}
              style={{ transformOrigin: "left center" }}
            />
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {t("stepCounter", { current: step + 1, total: STEP_COUNT })} · {stepLabels[step]}
      </p>

      {/* Keyed so each step animates in, which makes the transition legible
          instead of the copy swapping in place. */}
      <div key={step} className="rise mt-6">
        {step === 0 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("nameTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("nameBody")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-name">{t("nameLabel")}</Label>
              <Input
                id="wf-name"
                autoFocus
                value={name}
                maxLength={40}
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("currencyTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("currencyBody")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-currency">{t("currencyLabel")}</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v ?? currency)}
                items={currencyItems}
              >
                <SelectTrigger id="wf-currency" className="w-full">
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
              <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("accountTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("accountBody")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("accountTypeLabel")}</Label>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
                {STARTER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAcctType(type)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      acctType === type
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tType(type)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-acct-name">{t("accountNameLabel")}</Label>
              <Input
                id="wf-acct-name"
                autoFocus
                value={acctName}
                maxLength={80}
                placeholder={t("accountNamePlaceholder")}
                onChange={(e) => setAcctName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wf-acct-currency">{t("accountCurrencyLabel")}</Label>
                <Select
                  value={acctCurrency}
                  onValueChange={(v) => setAcctCurrency(v ?? acctCurrency)}
                  items={currencyItems}
                >
                  <SelectTrigger id="wf-acct-currency" className="w-full">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-acct-balance">{t("accountBalanceLabel")}</Label>
                <Input
                  id="wf-acct-balance"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={acctBalance}
                  placeholder="0.00"
                  onChange={(e) => setAcctBalance(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("cardStepTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("cardStepBody")}</p>
            </div>

            {/* The same stub form the import dialog offers when there is no card
                to import onto — three fields, because the statement fills the
                rest. Adding one hands straight over to its first import. */}
            <ImportCardStubStep
              onCreated={setImportFor}
              submitLabel={tStatements("stubSubmit")}
              defaultCurrency={currency}
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={back}
          disabled={!canGoBack || pending}
          className={cn(!canGoBack && "invisible")}
        >
          <ArrowLeft className="size-4" />
          {t("backButton")}
        </Button>
        {/* On the card step the primary action lives in the form above, so this
            is the way past it rather than the way through it. */}
        <Button
          onClick={next}
          disabled={!canAdvance || pending}
          isLoading={pending}
          variant={step === STEP_COUNT - 1 ? "ghost" : "default"}
        >
          {step === STEP_COUNT - 1 ? (
            t("cardStepSkip")
          ) : (
            <>
              {t("continueButton")}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>

      {/* The stub's first statement, offered the moment the card exists. Either
          outcome — imported or dismissed — ends onboarding. */}
      <StatementImportDialog
        open={importFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImportFor(null);
            void finish();
          }
        }}
        accountId={importFor ?? undefined}
        onImported={() => void finish()}
      />
    </div>
  );
}
