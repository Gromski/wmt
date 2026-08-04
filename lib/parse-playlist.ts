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
 * Matches four comma-separated two-uppercase-letter initials blocks.
 * Word-boundary anchors tolerate noise before/after the initials string.
 * e.g. "Curated by MW, JG, JS, IT" or "MW, JG, JS, IT — some other text"
 */
export const INITIALS_RE =
  /\b([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2})\b/;

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

  // Extract initials from description (null when description is undefined or no match)
  const initialsMatch = description?.match(INITIALS_RE);
  const initials = initialsMatch
    ? [initialsMatch[1], initialsMatch[2], initialsMatch[3], initialsMatch[4]]
    : null; // null → attributionParsed = false (IMPORT-08)

  // Extract YouTube fallback URL from description (Finding 2)
  const ytMatch = description?.match(YOUTUBE_RE);
  const youtubeUrl = ytMatch ? ytMatch[0] : null;

  return { sessionNumber, theme, initials, youtubeUrl };
}
