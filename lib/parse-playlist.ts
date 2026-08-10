// parse-playlist.ts — Server-side utility (no auth/db imports)
// Parses Apple Music playlist names and descriptions into structured session data.

/** Known contributor mapping: initials → full name (D-12) */
export const KNOWN_CONTRIBUTORS: Record<string, string> = {
  MW: "Mark Wright",
  JG: "Jack Groves",
  JS: "Jon Slade",
  IT: "Iwan Thomas",
};

/**
 * Matches four comma-separated initials blocks restricted to the four known contributors
 * (MW, JG, JS, IT). Word-boundary anchors tolerate noise before/after the initials string.
 * e.g. "Curated by MW, JG, JS, IT" or "MW, JG, JS, IT — some other text"
 * Restricting to known contributors (rather than any [A-Z]{2}) prevents an unrelated
 * four-token match from being accepted as parsed attribution (C2).
 */
export const INITIALS_RE =
  /\b(MW|JG|JS|IT),\s*(MW|JG|JS|IT),\s*(MW|JG|JS|IT),\s*(MW|JG|JS|IT)\b/;

/**
 * Matches an absence marker "<initials> MIA" / "<initials> = MIA" / "<initials> AWOL"
 * (case-insensitive, global). Captures the absent contributor's initials so they can be
 * excluded from round-robin attribution (e.g. "JS = MIA" → 3-person session). Use ONLY via
 * description.matchAll(ABSENCE_RE) (never .test()/.exec()) to avoid global-regex lastIndex state.
 */
export const ABSENCE_RE = /\b(MW|JG|JS|IT)\b\s*=?\s*(?:MIA|AWOL)\b/gi;

/**
 * Matches three comma-separated initials blocks restricted to the four known contributors
 * (MW, JG, JS, IT). Consulted ONLY as a fallback when an absence marker is present and the
 * strict four-initials INITIALS_RE match fails (e.g. "JG, IT, MW. JS MIA." lists only three
 * attendees).
 */
export const INITIALS_TRIO_RE =
  /\b(MW|JG|JS|IT),\s*(MW|JG|JS|IT),\s*(MW|JG|JS|IT)\b/;

/**
 * Matches the first standalone integer in the playlist name.
 * Used to extract the session number from names like "Session 07 — Desert Island Discs".
 */
export const SESSION_NUM_RE = /\b(\d+)\b/;

/**
 * Matches the session playlist naming convention "Warwick Massive Tunage <N>"
 * and captures the session number. Used to filter the Apple Music library down to
 * actual session playlists — the permissive SESSION_NUM_RE swept in editorial/seasonal
 * playlists whose numbers collided on the unique session_number column (Open Question 1).
 */
export const SESSION_PLAYLIST_RE = /warwick massive tunage\s+(\d+)/i;

/**
 * Matches a YouTube watch URL in a playlist description.
 * Covers https://www.youtube.com/watch?v=... and https://youtu.be/... (Finding 2).
 * NOTE: real-world description format is LOW confidence (RESEARCH.md OQ-1) — kept
 * defensive across both common forms; do not narrow to a single form.
 */
export const YOUTUBE_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/**
 * Parses an Apple Music playlist name and description into session metadata.
 *
 * @param name - The playlist name (e.g. "Session 07 — Desert Island Discs")
 * @param description - The playlist description (e.g. "MW, JG, JS, IT") or undefined
 * @returns sessionNumber, theme, initials (null when unparseable → IMPORT-08 trigger),
 *          and youtubeUrl (null when no YouTube URL is present in the description)
 */
export function parsePlaylistDescription(
  name: string,
  description: string | undefined,
): {
  sessionNumber: number;
  theme: string;
  initials: string[] | null;
  youtubeUrl: string | null;
} {
  // Extract session number from playlist name
  const numMatch = name.match(SESSION_NUM_RE);
  const sessionNumber = numMatch ? Number.parseInt(numMatch[1], 10) : 0;

  // Strip leading "Session N — " prefix (em-dash, en-dash, hyphen, colon all accepted)
  // Covers: "Session 07 — Theme", "Session 7 - Theme", "Session 7: Theme"
  const theme = name.replace(/session\s*\d+\s*[-–—:]?\s*/i, "").trim();

  // Extract the strict four-person initials list exactly as before.
  const initialsMatch = description?.match(INITIALS_RE);
  let initials: string[] | null = initialsMatch
    ? [initialsMatch[1], initialsMatch[2], initialsMatch[3], initialsMatch[4]]
    : null; // null → attributionParsed = false (IMPORT-08)

  // Absence handling (Finding: MIA/AWOL sessions). When a contributor is marked absent,
  // drop them so attribution round-robins only over those present. A description WITHOUT an
  // absence marker is unaffected — the strict four-person result above is returned verbatim.
  if (description) {
    const absent = new Set<string>();
    for (const m of description.matchAll(ABSENCE_RE))
      absent.add(m[1].toUpperCase());
    if (absent.size > 0) {
      if (!initials) {
        // Attendees listed as only three comma-separated initials (e.g. "JG, IT, MW. JS MIA.")
        const trio = description.match(INITIALS_TRIO_RE);
        initials = trio ? [trio[1], trio[2], trio[3]] : null;
      }
      if (initials) {
        const present = initials.filter((i) => !absent.has(i.toUpperCase()));
        initials = present.length >= 2 ? present : null;
      }
    }
  }

  // Extract YouTube fallback URL from description (Finding 2)
  const ytMatch = description?.match(YOUTUBE_RE);
  const youtubeUrl = ytMatch ? ytMatch[0] : null;

  return { sessionNumber, theme, initials, youtubeUrl };
}
