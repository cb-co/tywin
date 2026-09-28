"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One settings line: title and description, then its control.
 *
 * `inline` (the default) keeps a compact control — a switch, a two-way
 * choice, a button — on the title's line at every width, so a phone doesn't
 * strand it on a row of its own. `stacked` is for controls too wide to share
 * a phone's line (a text field, a select with long labels, the pay cycle):
 * they drop below the text, full width, and rejoin the line from `sm` up.
 */
export function Row({
  title,
  description,
  index,
  htmlFor,
  layout = "inline",
  children,
}: {
  title: string;
  description: string;
  index: number;
  htmlFor?: string;
  layout?: "inline" | "stacked";
  children: React.ReactNode;
}) {
  const Title = htmlFor ? Label : "p";
  return (
    <div
      className={cn(
        "rise flex py-5",
        layout === "inline"
          ? "items-center justify-between gap-4"
          : "flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
      )}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="min-w-0 space-y-0.5">
        <Title
          {...(htmlFor ? { htmlFor } : {})}
          className="text-sm font-medium text-foreground"
        >
          {title}
        </Title>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
