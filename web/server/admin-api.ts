import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.ADMIN_API_PORT ?? 3001);
const SONGS_PATH =
  process.env.SONGS_PATH ?? join(__dirname, "..", "..", "data", "songs.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SESSION_MS = 12 * 60 * 60 * 1000;

interface Song {
  id: string;
  title: string;
  artist: string;
  movie: string;
  year: number;
  spotifyUri?: string;
  youtubeId?: string;
}

interface SongsFile {
  playlistUrl: string;
  baseUrl: string;
  songs: Song[];
}

const sessions = new Map<string, number>();

function hashPassword(value: string) {
  return createHash("sha256").update(value).digest();
}

function verifyPassword(input: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  const a = hashPassword(input);
  const b = hashPassword(ADMIN_PASSWORD);
  return timingSafeEqual(a, b);
}

function isAuthed(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw) as T;
}

async function loadSongs(): Promise<SongsFile> {
  const raw = await readFile(SONGS_PATH, "utf-8");
  return JSON.parse(raw) as SongsFile;
}

async function saveSongs(data: SongsFile) {
  await writeFile(SONGS_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/songs") {
      const data = await loadSongs();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && path === "/api/admin/login") {
      if (!ADMIN_PASSWORD) {
        sendJson(res, 503, { error: "Admin password is not configured on the server." });
        return;
      }
      const body = await readJson<{ password?: string }>(req);
      if (!body.password || !verifyPassword(body.password)) {
        sendJson(res, 401, { error: "Invalid password." });
        return;
      }
      const token = randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + SESSION_MS);
      sendJson(res, 200, { token });
      return;
    }

    if (path === "/api/admin/youtube-ids") {
      if (!isAuthed(req)) {
        sendJson(res, 401, { error: "Unauthorized." });
        return;
      }

      if (req.method === "PUT") {
        const body = await readJson<{ updates?: Array<{ id: string; youtubeId: string | null }> }>(
          req,
        );
        if (!body.updates?.length) {
          sendJson(res, 400, { error: "No updates provided." });
          return;
        }

        const data = await loadSongs();
        const byId = new Map(data.songs.map((song) => [song.id, song]));

        for (const update of body.updates) {
          const song = byId.get(update.id);
          if (!song) continue;
          const trimmed = update.youtubeId?.trim() ?? "";
          if (!trimmed) {
            delete song.youtubeId;
          } else {
            song.youtubeId = trimmed;
          }
        }

        await saveSongs(data);
        sendJson(res, 200, { ok: true, songs: data.songs });
        return;
      }
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server error." });
  }
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: "Server error." });
  });
});

server.listen(PORT, () => {
  console.log(`Admin API listening on http://127.0.0.1:${PORT}`);
  console.log(`Songs file: ${SONGS_PATH}`);
  if (!ADMIN_PASSWORD) {
    console.warn("ADMIN_PASSWORD is not set — admin login is disabled.");
  }
});
