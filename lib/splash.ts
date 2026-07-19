/** Shared between the pre-paint script in the root layout and the splash
 *  overlay in the app shell. Kept in its own module so the root layout can
 *  import it without being pulled into the client bundle.
 *
 *  The flag lives in `sessionStorage`, so it is scoped to a single browser
 *  tab: the splash plays once per tab and never again on reload. That makes
 *  it almost invisible while developing, since Fast Refresh keeps the tab
 *  alive. Append `?splash` to any app URL to force it to play. */
export const SPLASH_SEEN_KEY = "cashly:splash-seen";

/** Runs synchronously during parse, before first paint.
 *
 *  Without it, a returning user would see the splash for one frame before
 *  React hydrated and removed it, which is worse than having no splash at
 *  all. The script only toggles a class on `<html>`; React still owns the
 *  overlay node, so hydration stays consistent.
 *
 *  Reduced-motion users skip it outright. A splash is a transition and
 *  nothing else, so when transitions are unwelcome the honest answer is to
 *  show the app immediately.
 *
 *  This must be rendered from a Server Component. React warns when a
 *  `<script>` is rendered by a Client Component, because it would never
 *  execute on a client-side render. */
export const SPLASH_SKIP_SCRIPT = `
(function () {
  try {
    if (new URLSearchParams(location.search).has("splash")) return;
    var seen = sessionStorage.getItem(${JSON.stringify(SPLASH_SEEN_KEY)});
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) document.documentElement.classList.add("splash-skip");
  } catch (e) {
    document.documentElement.classList.add("splash-skip");
  }
})();
`;
