"use client";

import { Label } from "@/components/ui/label";

export function Row({
  title,
  description,
  index,
  htmlFor,
  children,
}: {
  title: string;
  description: string;
  index: number;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Title = htmlFor ? Label : "p";
  return (
    <div
      className="rise flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="space-y-0.5">
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
