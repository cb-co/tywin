import { confirmStatementImport } from "@/app/(app)/accounts/statement-actions";
import { apiUser, badRequest, unauthorized } from "@/lib/api/respond";

/** The dialog's Import step. No LLM here: it validates the echoed statement and runs the import RPC. */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("invalid_form");
  }
  return Response.json(await confirmStatementImport(form));
}
