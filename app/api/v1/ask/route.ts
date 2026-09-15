/* The versioned path for the native app. It is the same handler, not a copy: /api/ask already
   authenticates through createClient(), which accepts a bearer token. Route segment config
   must be a literal in each route file, so maxDuration is restated rather than re-exported. */
export { GET, POST } from "@/app/api/ask/route";
export const maxDuration = 120;
