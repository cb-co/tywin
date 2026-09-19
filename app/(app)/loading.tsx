export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2 border-b pb-5">
        <div className="h-8 w-48 rounded-md bg-(--paper-line)" />
        <div className="h-4 w-72 rounded bg-(--paper-line)" />
      </div>
      {/* Unprinted ruled paper: static blocks, no shimmer. */}
      <div className="h-52 rounded-[6px] bg-(--paper-line)" />
      <div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 border-b border-(--paper-line)" />
        ))}
      </div>
    </div>
  );
}
