"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Row } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { isIosUserAgent } from "@/lib/pwa/is-ios";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "unsupported" | "installable" | "ios" | "installed";

export function InstallAppRow({ index }: { index: number }) {
  const t = useTranslations("Pwa");
  const [state, setState] = useState<InstallState>("unsupported");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standaloneFlag = (
      window.navigator as unknown as { standalone?: boolean }
    ).standalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      standaloneFlag === true;
    if (isStandalone) {
      setState("installed");
      return;
    }

    if (isIosUserAgent(window.navigator.userAgent)) {
      setState("ios");
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setState("installable");
    }

    function onAppInstalled() {
      deferredPrompt.current = null;
      setState("installed");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function onInstallClick() {
    const event = deferredPrompt.current;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setState("installed");
    }
    deferredPrompt.current = null;
  }

  if (state === "unsupported" || state === "installed") return null;

  return (
    <Row index={index} title={t("title")} description={t("description")}>
      {state === "ios" ? (
        <span className="max-w-56 text-right text-sm text-muted-foreground">
          {t("iosInstructions")}
        </span>
      ) : (
        <Button variant="outline" size="sm" onClick={onInstallClick}>
          <Download className="size-4" />
          {t("installButton")}
        </Button>
      )}
    </Row>
  );
}
