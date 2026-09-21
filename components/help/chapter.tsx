import type { LucideIcon } from "lucide-react";

export function HelpChapter({
  id,
  icon: Icon,
  index,
  title,
  intro,
  children,
}: {
  id: string;
  icon: LucideIcon;
  index: number;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b-2 border-(--rule) pb-10 pt-10 first:pt-0 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center border border-(--rule) text-foreground">
          <Icon className="size-4.5" />
        </span>
        <div>
          <p className="legend figure text-[10px] text-muted-foreground">Chapter {index}</p>
          <h2 className="legend text-base text-foreground">{title}</h2>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">{children}</div>
    </section>
  );
}

export function HelpCallout({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex gap-2.5 border-l-2 border-(--rule) bg-accent px-3.5 py-3 text-sm text-accent-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">{title}</span> {children}
      </p>
    </div>
  );
}
