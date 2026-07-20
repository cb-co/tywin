import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/auth", "/terms", "/privacy"];

/** A path is public only when it equals a public root or sits beneath it.
 *  A bare `startsWith` would also match `/loginsomething`, treating an
 *  unintended route as unauthenticated the moment one is added. */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Per-request Content-Security-Policy.
 *
 * This app ships two inline scripts that must run before first paint (the
 * splash skip check and next-themes' theme script), so a nonce is generated
 * here and consumed in `app/layout.tsx`. Setting the policy on the *request*
 * headers as well is what lets Next.js stamp the same nonce onto the scripts
 * it injects itself.
 *
 * `'unsafe-inline'` on style-src is deliberate: next/font, Next's own style
 * injection and every `style={{...}}` attribute in the tree need it, and
 * inline CSS cannot execute script. Keeping scripts on a nonce is where the
 * value is.
 *
 * `'unsafe-eval'` is added in development only, because Turbopack's HMR
 * client evaluates code at runtime. Production never gets it.
 */
function buildCsp(nonce: string): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dev = process.env.NODE_ENV === "development";

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    // Google's own OAuth avatar CDN, for the sidebar avatar image.
    `img-src 'self' data: blob: https://*.googleusercontent.com`,
    `font-src 'self' data:`,
    // Browser-side Supabase calls, plus its realtime websocket.
    `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}${dev ? " ws: http://localhost:*" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `worker-src 'self' blob:`,
    ...(dev ? [] : [`upgrade-insecure-requests`]),
  ].join("; ");
}

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  /* Next reads the nonce off the request's CSP header to nonce its own
     scripts, so both the request and the response must carry it. */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const withHeaders = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("content-security-policy", csp);
    return res;
  };

  let response = withHeaders();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild through the same helper so a refreshed session does not
          // silently drop the CSP and nonce.
          response = withHeaders();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
