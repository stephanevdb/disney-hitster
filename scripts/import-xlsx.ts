import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import type { Song, SongsFile } from "./types.ts";
import { DATA_DIR, SONGS_PATH, WEB_SONGS_PATH } from "./paths.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = join(
  DATA_DIR,
  "playlist_with_datesFemkeApproved.xlsx",
);
const DEFAULT_BASE_URL = "http://localhost:5173";

interface XlsxRow {
  year: number;
  title: string;
  artist: string;
  movie: string;
}

function parseArgs(argv: string[]) {
  let xlsxPath = DEFAULT_XLSX;
  let baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) {
      xlsxPath = argv[++i];
    } else if (argv[i] === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i];
    }
  }

  return { xlsxPath, baseUrl };
}

function titlesMatch(a: string, b: string): boolean {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.startsWith(right) || right.startsWith(left)) return true;
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  return longer.includes(shorter) && shorter.length >= 8;
}

function indexExistingSongs(songs: Song[]): Map<string, Song> {
  const map = new Map<string, Song>();
  for (const song of songs) {
    map.set(normalizeKey(song.title), song);
  }
  return map;
}

function findExistingSong(
  title: string,
  byExact: Map<string, Song>,
  all: Song[],
): Song | undefined {
  const exact = byExact.get(normalizeKey(title));
  if (exact) return exact;
  return all.find((song) => titlesMatch(song.title, title));
}

function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function toSongId(index: number): string {
  return String(index + 1).padStart(3, "0");
}

function parseYear(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const text = String(value ?? "").trim();
  const year = Number.parseInt(text, 10);
  return Number.isFinite(year) ? year : 0;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function readXlsxRows(xlsxPath: string): XlsxRow[] {
  const workbook = XLSX.read(readFileSync(xlsxPath), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const songs: XlsxRow[] = [];

  for (const row of rows) {
    const year = parseYear(row[0]);
    const title = cellText(row[1]);
    const artist = cellText(row[2]);
    const movie = cellText(row[3]);

    if (!title || !artist || !movie || year < 1900) continue;
    if (title.toLowerCase() === "title") continue;

    songs.push({ year, title, artist, movie });
  }

  return songs;
}

async function loadSongsFile(path: string): Promise<SongsFile | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as SongsFile;
  } catch {
    return null;
  }
}

async function loadExisting(): Promise<SongsFile | null> {
  return loadSongsFile(SONGS_PATH);
}

function mergeWithExisting(
  rows: XlsxRow[],
  existing: SongsFile | null,
  fallback: SongsFile | null,
  baseUrl: string,
): SongsFile {
  const priorSongs = [...(existing?.songs ?? []), ...(fallback?.songs ?? [])];
  const byExact = indexExistingSongs(priorSongs);

  const songs: Song[] = rows.map((row, index) => {
    const prev = findExistingSong(row.title, byExact, priorSongs);

    return {
      id: toSongId(index),
      title: row.title,
      artist: row.artist,
      movie: row.movie,
      year: row.year,
      ...(prev?.spotifyUri ? { spotifyUri: prev.spotifyUri } : {}),
      ...(prev?.youtubeId ? { youtubeId: prev.youtubeId } : {}),
    };
  });

  return {
    playlistUrl: existing?.playlistUrl ?? "",
    baseUrl,
    songs,
  };
}

async function main() {
  const { xlsxPath, baseUrl } = parseArgs(process.argv.slice(2));

  console.log(`Importing spreadsheet: ${xlsxPath}`);
  const rows = readXlsxRows(xlsxPath);
  if (rows.length === 0) {
    throw new Error("No songs found in spreadsheet");
  }

  const existing = await loadExisting();
  const fallback = await loadSongsFile(WEB_SONGS_PATH);
  const songsFile = mergeWithExisting(rows, existing, fallback, baseUrl);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SONGS_PATH, `${JSON.stringify(songsFile, null, 2)}\n`);

  const withYoutube = songsFile.songs.filter((song) => song.youtubeId).length;
  console.log(`Wrote ${songsFile.songs.length} songs to ${SONGS_PATH}`);
  console.log(`Reused ${withYoutube} existing YouTube IDs`);
  console.log("Next: npm run resolve-youtube (for any missing tracks)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
