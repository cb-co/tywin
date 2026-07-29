/** Mirrors the three bands of page.tsx — including the month picker sitting in
 *  the second band's heading rather than at the top — so nothing jumps when the
 *  real page swaps in. */
function SectionSkeleton({ nav, children }: { nav?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <div className="skeleton h-3 w-20 rounded" />
        {nav ? (
          <div className="flex shrink-0 items-center gap-2">
            <div className="skeleton size-8 rounded-md" />
            <div className="skeleton h-5 w-36 rounded" />
            <div className="skeleton size-8 rounded-md" />
          </div>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">{children}</div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="space-y-10">
        <SectionSkeleton>
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        </SectionSkeleton>
        <SectionSkeleton nav>
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </SectionSkeleton>
        <SectionSkeleton>
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </SectionSkeleton>
      </div>
    </div>
  );
}
