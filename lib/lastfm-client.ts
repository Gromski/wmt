// lastfm-client.ts — Server-side Last.fm API client
// Pure helper — no imports from @/lib/auth or @/lib/db.
// Rate-limit delay is the CALLER's responsibility (see import handler).

export const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

// Module-level guard: warn only once per process to avoid log spam
let warnedMissingKey = false;

/**
 * Fetches the top genre tags for an artist from Last.fm.
 *
 * Returns up to 5 lowercased tag names, or [] if:
 * - LASTFM_API_KEY is not set (logs a one-time warning)
 * - Last.fm returns an error code in the body (HTTP 200 with { error: N } — Pitfall 5)
 * - Artist is unknown (error 6) or any other error condition
 *
 * Does NOT throw. Caller handles [] gracefully (skip enrichment for this artist).
 */
export async function fetchArtistTags(artistName: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn(
        "[lastfm] LASTFM_API_KEY is not set — skipping artist tag enrichment",
      );
      warnedMissingKey = true;
    }
    return [];
  }

  const url = new URL(LASTFM_BASE);
  url.searchParams.set("method", "artist.gettoptags");
  url.searchParams.set("artist", artistName);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      toptags?: { tag: { name: string; count: number }[] };
      error?: number;
    };

    // Last.fm returns HTTP 200 for all responses including errors (Pitfall 5)
    if (data.error !== undefined || !data.toptags?.tag) {
      return [];
    }

    return data.toptags.tag.slice(0, 5).map((t) => t.name.toLowerCase());
  } catch {
    // Network error or JSON parse failure — return [] and let the caller continue
    return [];
  }
}
