"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { signIn, signUp, signInWithGoogle } from "@/app/login/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import s from "@/components/marketing/papel/papel.module.css";

/** Must match the Auth password policy in the Supabase dashboard
 *  (Authentication > Sign In / Providers > Email). Enforced server-side; this
 *  is only so the browser rejects a too-short password before a round trip. */
const PASSWORD_MIN_LENGTH = 8;

/** Sign in / sign up, drawn in the Papel Moneda world of the public pages.
 *  `initialMode` lets the home page's "Create account" land straight in
 *  sign-up mode instead of making the visitor find the toggle. */
export function LoginForm({ initialMode = "in" }: { initialMode?: "in" | "up" }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"in" | "up">(initialMode);
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
    <div className={s.authStack}>
      <div>
        <h1 className={s.authTitle}>{signingUp ? t("createTitle") : t("welcomeBack")}</h1>
        <p className={s.authLede}>{signingUp ? t("createBody") : t("welcomeBody")}</p>
      </div>

      <button
        type="button"
        className={s.btnOutline}
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={onGoogleClick}
      >
        {pending ? <Loader2 className={s.spin} aria-hidden /> : <GoogleIcon />}
        {t("continueWithGoogle")}
      </button>

      <div className={s.divider}>{t("orContinueWith")}</div>

      <form action={onSubmit} className={s.authStack}>
        <div className={s.field}>
          <label htmlFor="email">{t("email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={s.input}
          />
        </div>
        <div className={s.field}>
          <label htmlFor="password">{t("password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={s.input}
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
            <p id="password-rules" className={s.hint}>
              {t("passwordRules", { min: PASSWORD_MIN_LENGTH })}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className={s.btnPrimary}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? <Loader2 className={s.spin} aria-hidden /> : null}
          {pending ? t("pleaseWait") : signingUp ? t("createAccount") : t("signIn")}
        </button>
        <button
          type="button"
          className={s.switchMode}
          onClick={() => setMode(signingUp ? "in" : "up")}
        >
          {signingUp ? t("haveAccount") : t("needAccount")}
        </button>
      </form>

      <p className={s.terms}>
        {t.rich("termsAgreement", {
          terms: (chunks) => <Link href="/terms">{chunks}</Link>,
          privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
        })}
      </p>
    </div>
  );
}
