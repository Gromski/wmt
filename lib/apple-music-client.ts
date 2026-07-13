// apple-music-client.ts — Server-side Apple Music API client
// Pure helper — no imports from @/lib/auth or @/lib/db.

export const AM_BASE = "https://api.music.apple.com/v1";

/**
 * Minimal Apple Music library playlist type.
 * [ASSUMED] Shape derived from Apple Music API docs and community forum examples.
 * Official TypeScript SDK does not exist for this endpoint.
 */
export interface ApplePlaylist {
  id: string;
  attributes?: {
    name?: string;
    description?: {
      standard?: string;
    };
  };
}

/**
 * Minimal Apple Music library song type with catalog relationship.
 * [ASSUMED] Shape derived from Apple Developer Forums thread/688774 and thread/132606.
 * ISRC is NOT on library-songs directly — must use ?include=catalog (Pitfall 4).
 */
export interface AppleLibrarySong {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    trackNumber?: number;
    durationInMillis?: number;
    playParams?: {
      catalogId?: string;
    };
  };
  relationships?: {
    catalog?: {
      data?: Array<{
        id?: string;
        attributes?: {
          isrc?: string;
          releaseDate?: string;
          genreNames?: string[];
        };
      }>;
    };
  };
}

/**
 * Performs an authenticated GET to the Apple Music API.
 * Uses the two-header auth pattern: Authorization (developer JWT) + Music-User-Token.
 * Throws Error("Apple Music API <status> on <path>") on non-2xx — no token in message.
 */
export async function appleGet<T>(
  path: string,
  devToken: string,
  userToken: string,
): Promise<T> {
  const res = await fetch(`${AM_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${devToken}`,
      "Music-User-Token": userToken,
    },
  });

  if (!res.ok) {
    throw new Error(`Apple Music API ${res.status} on ${path}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetches ALL library playlists for the authenticated user, paginating with limit=100.
 * Filters out phantom records where attributes?.name is falsy (Pitfall 8).
 */
export async function fetchAllLibraryPlaylists(
  devToken: string,
  userToken: string,
): Promise<ApplePlaylist[]> {
  const all: ApplePlaylist[] = [];
  let offset = 0;
  const limit = 100; // [ASSUMED] max per request per Apple forums reports

  while (true) {
    const page = await appleGet<{ data: ApplePlaylist[]; next?: string }>(
      `/me/library/playlists?limit=${limit}&offset=${offset}`,
      devToken,
      userToken,
    );

    // Filter phantom records (Pitfall 8) before accumulating
    const validRecords = page.data.filter((p) => Boolean(p.attributes?.name));
    all.push(...validRecords);

    // Stop when fewer results than the limit (last page) or no next cursor
    if (!page.next || page.data.length < limit) {
      break;
    }
    offset += limit;
  }

  return all;
}

/**
 * Fetches ALL tracks for a given library playlist, paginating with limit=100.
 * Includes ?include=catalog to get ISRC + releaseDate from the catalog relationship (Pitfall 4).
 */
export async function fetchPlaylistTracks(
  playlistId: string,
  devToken: string,
  userToken: string,
): Promise<AppleLibrarySong[]> {
  const all: AppleLibrarySong[] = [];
  let offset = 0;

  while (true) {
    const page = await appleGet<{
      data: AppleLibrarySong[];
      next?: string;
    }>(
      `/me/library/playlists/${playlistId}/tracks?include=catalog&limit=100&offset=${offset}`,
      devToken,
      userToken,
    );

    all.push(...page.data);

    if (!page.next || page.data.length < 100) {
      break;
    }
    offset += 100;
  }

  return all;
}
