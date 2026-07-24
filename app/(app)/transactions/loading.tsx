export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="skeleton h-8 min-w-40 flex-1 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-8 w-40 rounded-lg" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((day) => (
          <div key={day} className="space-y-2">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
