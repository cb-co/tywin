"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronRight } from "lucide-react";
import { ACTIVITY_ITEMS, MOBILE_NAV_ITEMS } from "@/lib/nav";
import { DialogOverlay } from "@/components/ui/dialog";
import { LedgerRow } from "@/components/papel/ledger-row";
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
            "perforated-top fixed inset-x-0 bottom-0 z-50 rounded-t-[4px] border-t border-(--rule) bg-popover p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 text-popover-foreground outline-none",
            "duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          )}
        >
          {/* Grab handle. Purely a signal that the surface came from the
              bottom edge and dismisses downward. */}
          <DialogPrimitive.Title className="px-1 pb-2 font-heading text-base font-medium">
            {tActivity("title")}
          </DialogPrimitive.Title>

          <div className="flex flex-col">
            {ACTIVITY_ITEMS.map((sub) => {
              const current =
                pathname === sub.href || pathname.startsWith(sub.href + "/");
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className="block"
                >
                  {/* The description is what stops "Activity" from being an
                      opaque label. The current route carries a heavy left
                      rule (aria-current for assistive tech), never colour
                      alone. */}
                  <LedgerRow
                    className={cn(
                      "px-1",
                      current && "border-l-[3px] border-l-foreground pl-3",
                    )}
                    lead={<sub.icon className="size-5 shrink-0" />}
                    title={t(sub.key)}
                    subtitle={tActivity(`${sub.key}Desc`)}
                    amount={<ChevronRight className="size-4 text-muted-foreground" />}
                  />
                </Link>
              );
            })}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
