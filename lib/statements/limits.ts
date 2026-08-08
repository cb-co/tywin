/** How big a statement PDF the importer accepts.
 *
 *  Next caps a server action's request body at 1MB by default, and the upload
 *  travels as a server action's FormData — so a larger statement was rejected
 *  during body parsing, before `parseStatement` ran. That failure can't be
 *  caught or reported by the action: it surfaced as an unhandled render error
 *  on the account page instead of a toast.
 *
 *  Real statements exceed 1MB routinely — a text-layer PDF is a few hundred KB,
 *  but one carrying page images or a scanned insert runs to several MB. */
export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

/** What `next.config.ts` hands Next for `serverActions.bodySizeLimit`.
 *
 *  Deliberately above MAX_STATEMENT_BYTES: the body also carries the field
 *  names, multipart boundaries, the account id and any PDF password, so a file
 *  at exactly the file limit still has to fit. The headroom is what lets the
 *  app own the "too large" message — anything Next rejects at this outer limit
 *  is a forged or corrupt request, not a statement a user picked. */
export const SERVER_ACTION_BODY_LIMIT = "12mb";
