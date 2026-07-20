/** How the signed-in user is labelled across the shell.
 *
 *  `display_name` is optional, so every surface needs the same fallback
 *  chain rather than each one inventing its own. Order: the name the user
 *  chose, then the local part of their email, then a neutral placeholder. */

/** The label shown in the sidebar and anywhere the user is identified. */
export function profileLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim();
  if (name) return name;

  const local = email?.split("@")[0]?.trim();
  if (local) return local;

  return "";
}

/** Single character for the avatar bubble, derived from the same label so
 *  the bubble and the name below it never disagree. */
export function profileInitial(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  return profileLabel(displayName, email).trim()[0]?.toUpperCase() ?? "?";
}

/** First name only, for greetings. "Ana Lucía Ferrer" greets as "Ana" —
 *  a full legal name in a welcome line reads like a bank letter. Falls back
 *  to the whole label when there's nothing to split. */
export function greetingName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  return profileLabel(displayName, email).split(" ")[0] ?? "";
}

/** Avatar image URL from OAuth identity metadata, e.g. Supabase's
 *  `user.user_metadata` for a Google sign-in. Google's own key is
 *  `avatar_url`; some providers only set `picture`, so both are checked.
 *  Returns null when neither is set, so callers fall back to the
 *  initial-letter bubble instead of a broken image. */
export function profileAvatarUrl(
  metadata: { avatar_url?: unknown; picture?: unknown } | null | undefined,
): string | null {
  const url = metadata?.avatar_url ?? metadata?.picture;
  return typeof url === "string" && url.trim() ? url : null;
}
