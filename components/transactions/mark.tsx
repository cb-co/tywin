/** A printed micro-tag: engraved caps in a hairline frame, never a filled pill. */
export function Mark({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="legend inline-flex shrink-0 items-center gap-1 rounded-[2px] border border-(--ink-soft) px-1 py-px text-[9px] leading-none text-muted-foreground"
    >
      {children}
    </span>
  );
}
