"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Row } from "@/components/settings/row";
import { Button } from "@/components/ui/button";
import { isIosUserAgent } from "@/lib/pwa/is-ios";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "unsupported" | "installable" | "ios" | "installed";

/**
 * Installability is browser state, not React state: it comes from
 * `display-mode`, the user agent, and two window events. Reading it with
 * `useSyncExternalStore` instead of `useState` + `useEffect` is what
 * `react-hooks/set-state-in-effect` is asking for, and none of it can be
 * computed during server rendering — `getServerSnapshot` returns
 * "unsupported", which renders nothing, and the real value takes over after
 * hydration.
 *
 * These live at module scope because the store outlives the component:
 * `beforeinstallprompt` fires once and can arrive before this row mounts, and
 * the event object has to be kept to call `prompt()` on it later.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedDuringSession = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const media = window.matchMedia("(display-mode: standalone)");

  function onBeforeInstallPrompt(event: Event) {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  }

  function onAppInstalled() {
    deferredPrompt = null;
    installedDuringSession = true;
    emit();
  }

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  media.addEventListener("change", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
    media.removeEventListener("change", onStoreChange);
  };
}

/** Same precedence the previous effect used: already-installed wins, then iOS
 *  (which never fires `beforeinstallprompt`), then a captured prompt. */
function getSnapshot(): InstallState {
  if (installedDuringSession) return "installed";
  const standaloneFlag = (window.navigator as unknown as { standalone?: boolean }).standalone;
  if (window.matchMedia("(display-mode: standalone)").matches || standaloneFlag === true) {
    return "installed";
  }
  if (isIosUserAgent(window.navigator.userAgent, window.navigator.maxTouchPoints)) {
    return "ios";
  }
  return deferredPrompt ? "installable" : "unsupported";
}

function getServerSnapshot(): InstallState {
  return "unsupported";
}

export function InstallAppRow({ index }: { index: number }) {
  const t = useTranslations("Pwa");
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  async function onInstallClick() {
    const event = deferredPrompt;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") installedDuringSession = true;
    deferredPrompt = null;
    emit();
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
