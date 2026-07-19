"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { signIn, signUp } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"in" | "up">("in");
  const t = useTranslations("Login");

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const action = mode === "in" ? signIn : signUp;
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
      else if (mode === "up") toast.success(t("confirmEmail"));
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("pleaseWait") : mode === "in" ? t("signIn") : t("createAccount")}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? t("needAccount") : t("haveAccount")}
      </button>
    </form>
  );
}
