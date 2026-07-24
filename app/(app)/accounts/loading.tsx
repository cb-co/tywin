export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="space-y-10">
        <div className="flex justify-end">
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
        {[0, 1].map((section) => (
          <div key={section} className="space-y-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-36 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
