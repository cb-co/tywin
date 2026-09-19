import { Note } from "@/components/papel/note";

/** Alias kept so existing callers become a violet note at once; removed in Phase 7. */
export function HeroCard(props: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return <Note tone="violet" {...props} />;
}
