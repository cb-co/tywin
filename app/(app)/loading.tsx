export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-48 rounded-md" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="skeleton h-32 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
