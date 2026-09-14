import { refreshRecommendation } from "@/app/(app)/actions";
import { apiUser, unauthorized } from "@/lib/api/respond";

export const maxDuration = 60;

/**
 * Regenerates today's take if it is stale. The phone fires this on Overview mount
 * without awaiting it, as the web card does, and reads the row from
 * `daily_recommendations` directly.
 */
export async function POST() {
  if (!(await apiUser())) return unauthorized();
  return Response.json(await refreshRecommendation());
}
