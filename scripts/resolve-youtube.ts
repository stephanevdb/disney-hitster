import { readFile, writeFile } from "node:fs/promises";
import type { SongsFile } from "./types.ts";
import { SONGS_PATH } from "./paths.ts";

const SEARCH_DELAY_MS = 1200;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let force = false;
  for (const arg of argv) {
    if (arg === "--force") force = true;
  }
  return { force };
}

function primaryArtist(artist: string): string {
  return artist.split(",")[0]?.trim() ?? artist;
}

function searchQueries(title: string, artist: string): string[] {
  const mainArtist = primaryArtist(artist);
  return [
    `${title} ${mainArtist}`,
    `${title} ${artist}`,
    `${title} ${mainArtist} official`,
    `${title} Disney`,
  ];
}

async function fetchYouTubeResults(query: string): Promise<string | null> {
  const response = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
  );

  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  return match?.[1] ?? null;
}

async function searchYouTube(
  title: string,
  artist: string,
): Promise<string | null> {
  for (const query of searchQueries(title, artist)) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const videoId = await fetchYouTubeResults(query);
        if (videoId) return videoId;
      } catch {
        await sleep(800 * (attempt + 1));
      }
    }
    await sleep(400);
  }

  return null;
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  const raw = await readFile(SONGS_PATH, "utf-8");
  const data = JSON.parse(raw) as SongsFile;

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of data.songs) {
    if (song.youtubeId && !force) {
      skipped++;
      continue;
    }

    process.stdout.write(`Searching: ${song.title} — ${song.artist}... `);
    const youtubeId = await searchYouTube(song.title, song.artist);

    if (youtubeId) {
      song.youtubeId = youtubeId;
      resolved++;
      console.log(youtubeId);
    } else {
      failed++;
      console.log("not found");
    }

    await writeFile(SONGS_PATH, `${JSON.stringify(data, null, 2)}\n`);
    await sleep(SEARCH_DELAY_MS);
  }

  console.log(
    `\nResolved ${resolved} tracks, skipped ${skipped} existing, ${failed} not found.`,
  );
  console.log("Review songs.json and fix any wrong youtubeId values.");
  console.log("Next: npm run generate-cards");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
