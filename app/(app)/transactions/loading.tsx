export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="skeleton h-8 min-w-40 flex-1 rounded-none" />
        <div className="skeleton h-8 w-32 rounded-none" />
        <div className="skeleton h-8 w-40 rounded-none" />
        <div className="skeleton h-8 w-40 rounded-none" />
      </div>
      <div className="space-y-8">
        {[0, 1].map((month) => (
          <div key={month} className="space-y-3">
            <div className="skeleton h-3 w-28 rounded-none" />
            <div className="border-t-2 border-(--rule)" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 border-b border-(--paper-line) py-2.5">
                <div className="skeleton size-9 rounded-full" />
                <div className="skeleton h-4 flex-1 rounded-none" />
                <div className="skeleton h-4 w-16 rounded-none" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
