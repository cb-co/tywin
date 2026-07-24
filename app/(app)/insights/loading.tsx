export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="skeleton size-8 rounded-md" />
        <div className="skeleton h-6 w-32 rounded" />
        <div className="skeleton size-8 rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
