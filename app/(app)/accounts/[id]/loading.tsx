export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="skeleton size-11 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
        </div>
        <div className="skeleton h-8 w-40 rounded-lg" />
      </div>
      <div className="skeleton h-36 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}
