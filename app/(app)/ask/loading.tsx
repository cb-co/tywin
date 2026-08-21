import { Card } from "@/components/ui/card";

/** Mirrors page.tsx and the resting state of `AskChat` — the empty-state card,
 *  the ask row, the read-only line — so nothing jumps when the real page swaps
 *  in. Ask sets no width of its own, unlike every other route here, so this
 *  must not either: the inherited skeleton at `app/(app)/loading.tsx` capped
 *  itself at five columns and drew a hero and a three-card grid this page has
 *  never had, so the header moved and two blocks vanished on arrival. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b pb-5">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>

      <div className="flex flex-col gap-4">
        {/* The empty state is two centred lines in a card, so this is too —
            a solid block would be a grey slab where the invitation to ask sits. */}
        <Card className="p-6">
          <div className="skeleton mx-auto h-4 w-56 rounded" />
          <div className="skeleton mx-auto mt-1 h-3 w-72 rounded" />
        </Card>

        {/* Input and its button, at the height the real controls resolve to. */}
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-md" />
          <div className="skeleton h-10 w-16 rounded-md" />
        </div>

        <div className="skeleton h-3 w-80 max-w-full rounded" />
      </div>
    </div>
  );
}
