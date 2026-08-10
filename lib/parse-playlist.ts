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
 * Name → initials mapping for fallback-track attribution (BROWSE-03, D resolution in
 * 03-UAT.md). Both "Jon" and "Jonny" resolve to JS per the authoritative user resolution.
 */
export const NAME_TO_INITIALS: Record<string, string> = {
  Mark: "MW",
  Jack: "JG",
  Jon: "JS",
  Jonny: "JS",
  Iwan: "IT",
};

/**
 * Matches the canonical fallback-track sentence: "<Name>'s <descriptor> track: <Artist> -
 * <Title> <url>" (BROWSE-03). Name alternation is limited to the five known first names,
 * with "Jonny" listed before "Jon" so the longer name wins. Tolerates both a straight and
 * curly apostrophe. Descriptor is free text up to (but not crossing) the literal "track:".
 * Artist is non-greedy up to the first " - "; title is non-greedy up to the URL token.
 * Global + case-insensitive — consume ONLY via description.matchAll(FALLBACK_TRACK_RE)
 * (never .test()/.exec() on a /g regex — same lastIndex-state discipline as ABSENCE_RE).
 */
export const FALLBACK_TRACK_RE =
  /(Mark|Jack|Jonny|Jon|Iwan)['’]s\s+[^:]+?track:\s*(.+?)\s+-\s+(.+?)\s+(https?:\/\/\S+)/gi;

/**
 * Extracts a round number (1-4) from a fallback track's descriptor text (the free text
 * between the possessive and "track:", already captured by FALLBACK_TRACK_RE). Recognises
 * whole-word ordinals, case-insensitively: first/1st→1, second/2nd→2, third/3rd→3,
 * fourth/4th/last→4 (every contributor picks 4 tracks per session, so "last" = round 4).
 * Any other descriptor (a theme word like "love", or an explicit "bonus") → null, meaning
 * a bonus track with no declared grid slot (BROWSE-03 position-aware fallback design).
 */
function ordinalToRound(descriptor: string): number | null {
  const normalized = descriptor.trim().toLowerCase();
  if (/\b(first|1st)\b/.test(normalized)) return 1;
  if (/\b(second|2nd)\b/.test(normalized)) return 2;
  if (/\b(third|3rd)\b/.test(normalized)) return 3;
  if (/\b(fourth|4th|last)\b/.test(normalized)) return 4;
  return null;
}

/**
 * Re-extracts the descriptor text (free text between the possessive and "track:") from a
 * single fallback match's full matched text (match[0]). FALLBACK_TRACK_RE itself does not
 * capture this text in its own group — kept byte-identical per plan constraint — so this
 * mirrors its `['’]s\s+[^:]+?track:` shape locally, non-globally, on the already-isolated
 * match substring (safe to use .match() here since it is not a /g regex).
 */
function descriptorFromMatch(fullMatch: string): string {
  const m = fullMatch.match(/['’]s\s+([^:]+?)track:/i);
  return m ? m[1] : "";
}

/**
 * Extracts fallback (YouTube-only) tracks embedded in a playlist description, per the
 * canonical format documented at FALLBACK_TRACK_RE. Returns an ordered list — multiple
 * entries separated by " / " in the source text are all captured. Entries whose captured
 * name does not resolve to a known contributor are skipped. Each entry carries a `round`
 * derived from its descriptor's ordinal (BROWSE-03 position-aware fallback design) — null
 * when the descriptor is a theme word or explicit "bonus" (no declared grid slot). Does
 * NOT mutate or depend on parsePlaylistDescription's behavior.
 */
export function parseFallbackTracks(description: string | undefined): Array<{
  initials: string;
  artist: string;
  title: string;
  youtubeUrl: string;
  round: number | null;
}> {
  if (!description) return [];

  const results: Array<{
    initials: string;
    artist: string;
    title: string;
    youtubeUrl: string;
    round: number | null;
  }> = [];

  for (const match of description.matchAll(FALLBACK_TRACK_RE)) {
    const rawName = match[1].trim();
    const normalizedName =
      rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    const initials = NAME_TO_INITIALS[normalizedName];
    if (!initials) continue; // unresolvable name — skip (T-03-04-01)

    results.push({
      initials,
      artist: match[2].trim(),
      title: match[3].trim(),
      youtubeUrl: match[4].trim(),
      round: ordinalToRound(descriptorFromMatch(match[0])),
    });
  }

  return results;
}

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
 * Derives the session theme from the description's challenge text — the portion before the
 * attribution/initials string. Prefers a short clean lead sentence ("Pick your own theme.")
 * but keeps the full text for long single-sentence or numbered-list challenges. Falls back to
 * the playlist name when no usable text exists (e.g. the description is only an initials list).
 */
function deriveThemeFromDescription(
  name: string,
  description: string | undefined,
): string {
  if (!description) return name;
  let cut = description.length;
  for (const re of [INITIALS_RE, INITIALS_TRIO_RE]) {
    const m = description.match(re);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  const abs = description.match(/\b(MW|JG|JS|IT)\b\s*=?\s*(?:MIA|AWOL)\b/i);
  if (abs && abs.index !== undefined && abs.index < cut) cut = abs.index;
  const head = description.slice(0, cut).replace(/\s+/g, " ").trim();
  if (!head || !/[a-z]/i.test(head)) return name;
  const enumerated = /(^|\s)[1-9][.)]\s/.test(head);
  let theme: string;
  if (enumerated) {
    theme = head;
  } else {
    const lead = head.match(/^(.{4,60}?[.!?])(\s|$)/);
    theme = lead && lead[1].length < head.length ? lead[1] : head;
  }
  theme = theme.replace(/[\s.,;:—–-]+$/, "").trim();
  return theme || name;
}

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

  // Derive theme from the description's challenge text (falls back to the playlist name).
  const theme = deriveThemeFromDescription(name, description);

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
