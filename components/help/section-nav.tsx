"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* `icon` is a pre-rendered node, not a component reference: a Server
   Component can't hand a component reference to a Client Component as
   plain prop data (only rendered elements / "use client" references
   serialize across that boundary). */
export type HelpSection = { id: string; label: string; icon: React.ReactNode };

/** Sticky in-page rail for the Help guide, mirroring the app's own sidebar
 *  pattern. Highlights the section currently in view via IntersectionObserver
 *  rather than scroll math, so it stays cheap on long pages. */
export function SectionNav({ sections }: { sections: HelpSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    targets.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [sections]);

  return (
    <nav
      className={cn(
        "sticky top-4 z-10 -mx-1 flex gap-1 overflow-x-auto px-1 pb-2",
        "md:top-8 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0",
      )}
      aria-label="Guide sections"
    >
      {sections.map(({ id, label, icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            activeId === id && "bg-accent text-accent-foreground",
          )}
        >
          {icon}
          <span className="whitespace-nowrap">{label}</span>
        </a>
      ))}
    </nav>
  );
}
