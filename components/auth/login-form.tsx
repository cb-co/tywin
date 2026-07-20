"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { signIn, signUp, signInWithGoogle } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/auth/google-icon";

/** Must match the Auth password policy in the Supabase dashboard
 *  (Authentication > Sign In / Providers > Email). Enforced server-side; this
 *  is only so the browser rejects a too-short password before a round trip. */
const PASSWORD_MIN_LENGTH = 8;

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"in" | "up">("in");
  const t = useTranslations("Login");
  const signingUp = mode === "up";

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const action = signingUp ? signUp : signIn;
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
      else if (signingUp) toast.success(t("confirmEmail"));
    });
  }

  function onGoogleClick() {
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onGoogleClick}
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {t("orContinueWith")}
        <div className="h-px flex-1 bg-border" />
      </div>
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            // Mirrors the project's Auth policy. If that minimum changes in the
            // dashboard, change it here too: a lower value here just moves the
            // rejection from the field to a toast after a round trip.
            minLength={PASSWORD_MIN_LENGTH}
            // "new-password" is what makes a password manager offer to generate
            // and save one. With complexity rules enforced server-side, sending
            // "current-password" on sign-up actively pushes people toward
            // weaker, hand-typed passwords.
            autoComplete={signingUp ? "new-password" : "current-password"}
            aria-describedby={signingUp ? "password-rules" : undefined}
          />
          {signingUp ? (
            <p id="password-rules" className="text-xs text-muted-foreground">
              {t("passwordRules", { min: PASSWORD_MIN_LENGTH })}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("pleaseWait") : signingUp ? t("createAccount") : t("signIn")}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(signingUp ? "in" : "up")}
        >
          {signingUp ? t("haveAccount") : t("needAccount")}
        </button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        {t.rich("termsAgreement", {
          terms: (chunks) => (
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
