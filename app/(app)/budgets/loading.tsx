export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="skeleton h-24 rounded-xl" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
