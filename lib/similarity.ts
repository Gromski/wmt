// lib/similarity.ts — pure math for ANALYTICS-02 (pairwise overlap) and
// ANALYTICS-03 (wildcard divergence). No DB, no I/O — mirrors the
// lib/parse-playlist.ts pure-function module pattern (04-PATTERNS.md §
// lib/similarity.ts): individually-exported named functions, no class/
// default export. Public API accepts Record<string, number> (serialisation-
// agnostic across the RSC boundary) and converts to Map internally.

// [ASSUMED — post-UAT tuning knob, RESEARCH A2] D-04 locks "blended, weighted
// toward artists"; the exact 0.7/0.3 split is a recommendation, not a locked
// number. One-line change here retunes every pairwise/overlap score.
export const SIMILARITY_WEIGHTS = { artist: 0.7, genre: 0.3 } as const;

// [ASSUMED — post-UAT tuning knob, RESEARCH A3] D-06 locks "genre/era profile"
// as the divergence input; the exact blend ratio is a recommendation. LIVE:
// buildProfileVector/divergenceRanking below route every contributor through
// this constant (or an explicit override), so retuning it genuinely changes
// the wildcard result.
export const PROFILE_WEIGHTS = { genre: 0.5, era: 0.5 } as const;

function toMap(record: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(record));
}

/**
 * Cosine similarity between two sparse non-negative vectors. Returns 1 for
 * identical vectors, 0 for disjoint vectors, and 0 (not NaN) when either
 * vector has zero norm (no data → no defined similarity).
 */
export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const mapA = toMap(a);
  const mapB = toMap(b);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valA] of mapA) {
    normA += valA * valA;
    const valB = mapB.get(key);
    if (valB) dot += valA * valB;
  }
  for (const valB of mapB.values()) normB += valB * valB;

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Blend of artist-vector cosine and genre-vector cosine per
 * SIMILARITY_WEIGHTS (D-04: weighted toward artists). Bounded in [0, 1].
 */
export function pairwiseSimilarity(
  aArtist: Record<string, number>,
  aGenre: Record<string, number>,
  bArtist: Record<string, number>,
  bGenre: Record<string, number>,
): number {
  return (
    SIMILARITY_WEIGHTS.artist * cosineSimilarity(aArtist, bArtist) +
    SIMILARITY_WEIGHTS.genre * cosineSimilarity(aGenre, bGenre)
  );
}

/**
 * NxN symmetric overlap matrix. matrix[i][j] = pairwiseSimilarity between
 * contributors[i] and contributors[j]; diagonal forced to 1 (self-overlap).
 */
export function buildOverlapMatrix(
  contribs: {
    artistVector: Record<string, number>;
    genreVector: Record<string, number>;
  }[],
): number[][] {
  const n = contribs.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const score =
        i === j
          ? 1
          : pairwiseSimilarity(
              contribs[i].artistVector,
              contribs[i].genreVector,
              contribs[j].artistVector,
              contribs[j].genreVector,
            );
      matrix[i][j] = score;
      matrix[j][i] = score;
    }
  }

  return matrix;
}

/**
 * Applies the LIVE PROFILE_WEIGHTS (or an explicit override) to Plan 01's
 * raw, unweighted genreProportions/decadeProportions. This is the only place
 * the weighting is applied — Plan 01 no longer bakes a profileVector, so
 * changing `weights` here genuinely changes the output vector and therefore
 * divergenceRanking below.
 */
export function buildProfileVector(
  contrib: {
    genreProportions: Record<string, number>;
    decadeProportions: Record<string, number>;
  },
  weights: { genre: number; era: number } = PROFILE_WEIGHTS,
): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const [genre, share] of Object.entries(contrib.genreProportions)) {
    vector[`genre:${genre}`] = share * weights.genre;
  }
  for (const [decade, share] of Object.entries(contrib.decadeProportions)) {
    vector[`decade:${decade}`] = share * weights.era;
  }
  return vector;
}

function groupCentroid(
  vectors: Record<string, number>[],
): Record<string, number> {
  const centroid: Record<string, number> = {};
  const count = vectors.length || 1;
  for (const vec of vectors) {
    for (const [key, value] of Object.entries(vec)) {
      centroid[key] = (centroid[key] ?? 0) + value / count;
    }
  }
  return centroid;
}

/**
 * Ranks contributors by divergence from the group centroid built over their
 * weighted profile vectors (buildProfileVector, LIVE PROFILE_WEIGHTS).
 * divergence = 1 - cosineSimilarity(profileVector, centroid). Sorted
 * descending — [0] is the wildcard (D-06/D-07).
 */
export function divergenceRanking(
  contribs: {
    initials: string;
    name: string;
    genreProportions: Record<string, number>;
    decadeProportions: Record<string, number>;
  }[],
  weights: { genre: number; era: number } = PROFILE_WEIGHTS,
): { initials: string; name: string; divergence: number }[] {
  const profileVectors = contribs.map((contrib) =>
    buildProfileVector(contrib, weights),
  );
  const centroid = groupCentroid(profileVectors);

  return contribs
    .map((contrib, i) => ({
      initials: contrib.initials,
      name: contrib.name,
      divergence: 1 - cosineSimilarity(profileVectors[i], centroid),
    }))
    .sort((a, b) => b.divergence - a.divergence);
}
