import s from "./papel.module.css";

/**
 * The microprinted border every banknote carries, here in both languages.
 * Four strips of tiny repeated legend inside a hairline frame; purely
 * ornamental, so it is hidden from assistive tech (the same words are on the
 * page in full size).
 */
export function Microprint({ text, className }: { text: string; className?: string }) {
  const run = text.repeat(12);
  return (
    <div aria-hidden className={`${s.microprint} ${className ?? ""}`}>
      <span className={s.mpTop}>{run}</span>
      <span className={s.mpBottom}>{run}</span>
      <span className={s.mpLeft}>{run}</span>
      <span className={s.mpRight}>{run}</span>
    </div>
  );
}

/** A serial number in the note's corner. Decorative, like the real thing. */
export function Serial({ value, className }: { value: string; className?: string }) {
  return (
    <span aria-hidden className={`${s.serial} ${className ?? ""}`}>
      {value}
    </span>
  );
}
