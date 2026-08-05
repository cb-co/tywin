/**
 * The account detail skeleton.
 *
 * Shaped for a CREDIT CARD, which is worth stating because this route also
 * serves chequing accounts and loans and `loading.tsx` cannot know which is
 * coming — it renders before the account is fetched. Cards win the tie: they
 * are the only type whose page opens with a full-bleed object, so they are the
 * type that visibly jumps when the skeleton omits it. A loan gets one block of
 * reserved space it does not use, which settles upward once.
 *
 * The header carries no tile for the same reason. The page hides its ColorTile
 * whenever a face is drawn, so a skeleton showing both would promise a layout
 * that never arrives.
 *
 * The face's numbers mirror PaymentCard exactly — aspect, cap, radius, and the
 * centre-then-left alignment at `sm`. A skeleton whose proportions differ from
 * the thing it stands in for is worse than none: it promises a shape and then
 * moves.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="space-y-2">
          <div className="skeleton h-6 w-40 rounded" />
          <div className="skeleton h-4 w-28 rounded" />
        </div>
        <div className="skeleton h-8 w-40 rounded-lg" />
      </div>
      <div className="skeleton mx-auto aspect-[1.7] w-full max-w-[22rem] rounded-[0.75rem] sm:mx-0" />
      <div className="skeleton h-36 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}
