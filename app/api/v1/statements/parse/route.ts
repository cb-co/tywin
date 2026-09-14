import { parseStatement } from "@/app/(app)/accounts/statement-actions";
import { apiUser, badRequest, unauthorized } from "@/lib/api/respond";

/* PDF render plus one Gemini call, with the same cold-start exposure /api/ask documents. */
export const maxDuration = 120;

/**
 * The upload dialog's parse step, for the native app. Same action, same limits
 * (size cap, per-user parse budget), same preview shape. The phone echoes
 * `parsedStatement` back to /confirm exactly as the dialog does.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("invalid_form");
  }
  return Response.json(await parseStatement(form));
}
