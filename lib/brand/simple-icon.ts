import "server-only";
import * as icons from "simple-icons";

/**
 * The Simple Icons set, addressable by slug.
 *
 * ~3,450 brand marks as single SVG paths on a 24×24 grid, optically balanced
 * against each other by the project — which is why callers can render any of
 * them at one size and trust the result. The package is CC0; the marks are still
 * their owners' trademarks, used here to identify a service someone told us they
 * pay for.
 *
 * SERVER ONLY, and the `server-only` import is load-bearing rather than
 * decorative. `import * as icons` pulls the entire 3,450-icon module — megabytes
 * — and a client component importing this by accident would ship all of it to
 * every visitor to save one path string. The guard turns that mistake into a
 * build error instead of a bundle. Callers resolve on the server and pass the
 * `path` down as a prop; see lib/subscriptions/queries.ts.
 *
 * The index is built once, lazily, on first lookup: a 3,450-entry Map costs
 * about a millisecond to build and is then free, but building it at module load
 * would charge that to every cold start whether or not anything asks.
 */
export type BrandIcon = {
  slug: string;
  /** The `d` attribute of a single path on a 0 0 24 24 viewBox. */
  path: string;
  /** The brand's official colour as a 6-digit hex, with its leading `#`. */
  hex: string;
};

type RawIcon = { slug?: unknown; path?: unknown; hex?: unknown };

let index: Map<string, BrandIcon> | null = null;

function bySlug(): Map<string, BrandIcon> {
  if (index) return index;
  index = new Map();
  // Guarded rather than cast: the package's exports are all icons today, and a
  // future non-icon export should be skipped, not crash the accounts page.
  for (const raw of Object.values(icons) as RawIcon[]) {
    if (typeof raw?.slug !== "string" || typeof raw.path !== "string") continue;
    if (typeof raw.hex !== "string") continue;
    index.set(raw.slug, { slug: raw.slug, path: raw.path, hex: `#${raw.hex}` });
  }
  return index;
}

/**
 * Looks up one mark. Returns null for an unknown slug, which is the normal case
 * rather than an error: it is how a model's invented slug is rejected, and how a
 * service nobody has drawn a logo for falls back to its initial.
 */
export function brandIcon(slug: string | null | undefined): BrandIcon | null {
  const s = slug?.trim().toLowerCase();
  return s ? (bySlug().get(s) ?? null) : null;
}
