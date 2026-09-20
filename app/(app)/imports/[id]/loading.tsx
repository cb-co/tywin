export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-48 rounded-md" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="skeleton h-4 w-56 rounded-none" />
      <div className="border border-(--paper-line)">
        {[0, 1, 2, 3].map((block) => (
          <div key={block} className="space-y-3 border-b-2 border-(--rule) px-4 py-3 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40 rounded-none" />
                <div className="skeleton h-3 w-56 rounded-none" />
              </div>
              <div className="skeleton h-4 w-16 rounded-none" />
            </div>
            <div className="skeleton h-8 w-full rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
