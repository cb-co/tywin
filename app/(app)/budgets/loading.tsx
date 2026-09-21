import { DoubleRule } from "@/components/papel/double-rule";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>
      <div className="skeleton h-44 rounded-[6px]" />
      <div className="space-y-px">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>

      <DoubleRule />

      <div className="space-y-4">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-4">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-8 w-28 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
