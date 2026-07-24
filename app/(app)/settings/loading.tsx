export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="skeleton h-96 rounded-xl" />
      <div className="skeleton h-20 rounded-xl" />
    </div>
  );
}
