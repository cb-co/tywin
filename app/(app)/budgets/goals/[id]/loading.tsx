export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="space-y-3 border-b pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="skeleton size-11 rounded-xl" />
            <div className="skeleton h-6 w-40 rounded" />
          </div>
          <div className="skeleton h-6 w-28 rounded" />
        </div>
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>
      <div className="skeleton h-64 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}
