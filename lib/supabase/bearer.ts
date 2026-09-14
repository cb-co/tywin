/**
 * The access token from an `Authorization: Bearer <jwt>` header, or null.
 *
 * The native app has no cookie jar, so it sends the Supabase access token this way.
 * This only extracts it and does not check it. Verification is `auth.getUser()` on the
 * client built from it, the same call every server action already makes.
 */
export function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
