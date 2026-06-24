import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Song, SongsFile } from "./types.ts";
import { DATA_DIR, SONGS_PATH } from "./paths.ts";

const DEFAULT_PLAYLIST =
  "https://open.spotify.com/playlist/0J4kExmMxPfVhbqVq1xTph";
const DEFAULT_BASE_URL = "http://localhost:5173";

interface SpotifyTrack {
  title: string;
  artist: string;
  spotifyUri: string;
  year: number;
}

function parseArgs(argv: string[]) {
  let playlist = DEFAULT_PLAYLIST;
  let baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--playlist" && argv[i + 1]) {
      playlist = argv[++i];
    } else if (argv[i] === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i];
    }
  }

  return { playlist, baseUrl };
}

function extractPlaylistId(url: string): string {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error(`Could not parse playlist ID from: ${url}`);
  }
  return match[1];
}

function extractYear(releaseDate: string | undefined): number {
  if (!releaseDate) return 0;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : 0;
}

async function fetchTrackYear(spotifyUri: string): Promise<number | null> {
  const trackId = spotifyUri.replace("spotify:track:", "");
  try {
    const response = await fetch(
      `https://open.spotify.com/embed/track/${trackId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
    );
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) return null;
    const nextData = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          state?: {
            data?: {
              entity?: {
                releaseDate?: { isoString?: string };
              };
            };
          };
        };
      };
    };
    const iso =
      nextData.props?.pageProps?.state?.data?.entity?.releaseDate?.isoString;
    return extractYear(iso) || null;
  } catch {
    return null;
  }
}

async function enrichYears(tracks: SpotifyTrack[]): Promise<SpotifyTrack[]> {
  const enriched: SpotifyTrack[] = [];
  for (const track of tracks) {
    const year = await fetchTrackYear(track.spotifyUri);
    enriched.push({
      ...track,
      year: year ?? (track.year > 0 ? track.year : 2000),
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return enriched;
}

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function fetchViaApi(
  playlistId: string,
  token: string,
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        track: {
          name: string;
          artists: Array<{ name: string }>;
          uri: string;
          album: { release_date: string };
        } | null;
      }>;
      next: string | null;
    };

    for (const item of data.items) {
      if (!item.track) continue;
      tracks.push({
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
        spotifyUri: item.track.uri,
        year: extractYear(item.track.album.release_date),
      });
    }

    url = data.next;
  }

  return tracks;
}

async function fetchViaEmbed(playlistId: string): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `https://open.spotify.com/embed/playlist/${playlistId}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Spotify embed fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error("Could not find playlist data in Spotify embed page");
  }

  const nextData = JSON.parse(match[1]) as {
    props?: {
      pageProps?: {
        state?: {
          data?: {
            entity?: {
              trackList?: Array<{
                title: string;
                subtitle: string;
                uri: string;
                releaseDate?: { isoString?: string };
              }>;
            };
          };
        };
      };
    };
  };

  const trackList =
    nextData.props?.pageProps?.state?.data?.entity?.trackList ?? [];

  if (trackList.length === 0) {
    throw new Error("No tracks found in Spotify embed data");
  }

  return trackList.map((track) => ({
    title: track.title,
    artist: track.subtitle,
    spotifyUri: track.uri,
    year: extractYear(track.releaseDate?.isoString),
  }));
}

function toSongId(index: number): string {
  return String(index + 1).padStart(3, "0");
}

async function loadExisting(): Promise<SongsFile | null> {
  try {
    const raw = await readFile(SONGS_PATH, "utf-8");
    return JSON.parse(raw) as SongsFile;
  } catch {
    return null;
  }
}

function mergeTracks(
  tracks: SpotifyTrack[],
  existing: SongsFile | null,
  playlistUrl: string,
  baseUrl: string,
): SongsFile {
  const existingByUri = new Map(
    existing?.songs.map((s) => [s.spotifyUri, s]) ?? [],
  );

  const songs: Song[] = tracks.map((track, index) => {
    const id = toSongId(index);
    const prev = existingByUri.get(track.spotifyUri);

    return {
      id,
      title: track.title,
      artist: track.artist,
      year: track.year,
      spotifyUri: track.spotifyUri,
      ...(prev?.youtubeId ? { youtubeId: prev.youtubeId } : {}),
    };
  });

  return { playlistUrl, baseUrl, songs };
}

async function main() {
  const { playlist, baseUrl } = parseArgs(process.argv.slice(2));
  const playlistId = extractPlaylistId(playlist);

  console.log(`Importing playlist: ${playlist}`);

  const token = await getSpotifyToken();
  let tracks = token
    ? await fetchViaApi(playlistId, token)
    : await fetchViaEmbed(playlistId);

  if (!token) {
    console.log("Enriching release years from Spotify track pages...");
    tracks = await enrichYears(tracks);
  }

  console.log(`Found ${tracks.length} tracks`);

  const existing = await loadExisting();
  const songsFile = mergeTracks(tracks, existing, playlist, baseUrl);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SONGS_PATH, `${JSON.stringify(songsFile, null, 2)}\n`);

  console.log(`Wrote ${SONGS_PATH}`);
  console.log("Next: npm run resolve-youtube");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
