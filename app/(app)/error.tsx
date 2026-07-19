"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div>
        <p className="text-xl font-medium text-foreground">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This screen hit an error. Try again — if it keeps happening, reload the page.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
