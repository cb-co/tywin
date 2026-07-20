"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronRight } from "lucide-react";
import { ACTIVITY_ITEMS, MOBILE_NAV_ITEMS } from "@/lib/nav";
import { DialogOverlay } from "@/components/ui/dialog";
import { NavItemBody, navItemClass, useNavActive } from "./nav-link";
import { cn } from "@/lib/utils";

/**
 * Read here rather than passed as a prop: `icon` is a component, and a server
 * component cannot serialise one across the client boundary. NavLink dodges
 * this by receiving its icon as already-rendered children.
 */
const ITEM = MOBILE_NAV_ITEMS.find((i) => i.kind === "sheet")!;

/**
 * The Activity cell. Opens a sheet listing both routes rather than navigating,
 * so Subscriptions is visible the moment the tab is tapped instead of hiding
 * one level inside Transactions.
 */
export function ActivitySheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const tActivity = useTranslations("Activity");
  const active = useNavActive(ITEM.href, ITEM.match);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        // A button, not a link: it opens a chooser. Styled by the same helper
        // as its neighbours so the row stays visually uniform.
        className={navItemClass("bottom", active)}
      >
        <NavItemBody variant="bottom" active={active} label={t(ITEM.key)}>
          <ITEM.icon className="h-5 w-5 shrink-0" />
        </NavItemBody>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-popover p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-popover-foreground outline-none",
            "duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          )}
        >
          {/* Grab handle. Purely a signal that the surface came from the
              bottom edge and dismisses downward. */}
          <div
            aria-hidden
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30"
          />
          <DialogPrimitive.Title className="px-1 pb-2 font-heading text-base font-medium">
            {tActivity("title")}
          </DialogPrimitive.Title>

          <div className="flex flex-col gap-1">
            {ACTIVITY_ITEMS.map((sub) => {
              const current =
                pathname === sub.href || pathname.startsWith(sub.href + "/");
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                    current
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent bg-muted/40 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      current
                        ? "bg-primary/15 text-primary"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    <sub.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t(sub.key)}</span>
                    {/* The description is what stops "Activity" from being an
                        opaque label — it says outright what lives in here. */}
                    <span className="block text-xs text-muted-foreground">
                      {tActivity(`${sub.key}Desc`)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
