// Phase 4 ANALYTICS-01 (D-01) — LOCKED curation.
// Curated from a live survey of all 370 distinct artist_tags.tag values
// in local.db (SELECT tag, COUNT(*) FROM artist_tags GROUP BY tag ORDER BY 2 DESC).
// Only tags with count >= 3 in the current dataset were considered for
// inclusion — the long tail (junk tags like "funk_add_to_lidarr_batch_4",
// geography like "welsh"/"canadian", descriptors like "female vocalists",
// decades like "80s", labels like "4ad"/"stones throw", and one-off artist
// names used as tags like "prince"/"kenny rogers") is deliberately left out.
// Anything absent from GENRE_MAP resolves to null — there is no separate
// exclusion list, absence from the map IS the exclusion.
export const GENRE_MAP: Record<string, string> = {
  // Rock family
  rock: "Rock",
  "classic rock": "Rock",
  "progressive rock": "Rock",
  "hard rock": "Rock",
  "psychedelic rock": "Rock",
  "blues rock": "Rock",
  "folk rock": "Rock",
  "punk rock": "Rock",
  "glam rock": "Rock",
  "soft rock": "Rock",
  // Alternative / Indie
  alternative: "Alternative",
  "alternative rock": "Alternative",
  indie: "Indie",
  "indie rock": "Indie",
  "indie pop": "Indie",
  britpop: "Indie",
  // Electronic family
  electronic: "Electronic",
  electronica: "Electronic",
  idm: "Electronic",
  techno: "Techno",
  house: "House",
  "deep house": "House",
  dubstep: "Dubstep",
  chillout: "Chillout",
  downtempo: "Chillout",
  "trip-hop": "Trip-Hop",
  // Pop
  pop: "Pop",
  synthpop: "Synth-Pop",
  "synth pop": "Synth-Pop",
  // Soul / Funk / Jazz
  soul: "Soul",
  motown: "Soul",
  "northern soul": "Soul",
  "neo-soul": "Soul",
  funk: "Funk",
  "jazz-funk": "Funk",
  jazz: "Jazz",
  "acid jazz": "Jazz",
  "jazz fusion": "Jazz",
  fusion: "Jazz",
  // Hip-Hop / R&B
  "hip-hop": "Hip-Hop",
  "hip hop": "Hip-Hop",
  rap: "Hip-Hop",
  "gangsta rap": "Hip-Hop",
  rnb: "R&B",
  "rhythm and blues": "R&B",
  // Folk / Singer-Songwriter / New Wave
  folk: "Folk",
  "singer-songwriter": "Singer-Songwriter",
  "new wave": "New Wave",
  // Reggae family
  reggae: "Reggae",
  "roots reggae": "Reggae",
  roots: "Reggae",
  dancehall: "Reggae",
  ragga: "Reggae",
  dub: "Reggae",
  rasta: "Reggae",
  // Drum & Bass
  "drum and bass": "Drum & Bass",
  jungle: "Drum & Bass",
  "drum n bass": "Drum & Bass",
  dnb: "Drum & Bass",
  // Punk
  punk: "Punk",
  "post-punk": "Post-Punk",
  // Misc
  disco: "Disco",
  blues: "Blues",
  dance: "Dance",
  psychedelic: "Psychedelic",
  experimental: "Experimental",
  afrobeat: "Afrobeat",
  world: "World",
  ambient: "Ambient",
  metal: "Metal",
  country: "Country",
  classical: "Classical",
  latin: "Latin",
};

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function resolveGenre(tag: string): string | null {
  return GENRE_MAP[normalizeTag(tag)] ?? null;
}
