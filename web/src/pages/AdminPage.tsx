import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSongs } from "../context/SongsContext";
import type { Song } from "../lib/songs";

const TOKEN_KEY = "dh-admin-token";

interface EditableSong extends Song {
  draftYoutubeId: string;
}

interface SongsMeta {
  path: string;
  size: number | null;
  mtimeMs: number | null;
  mtime: string | null;
}

interface SaveResult {
  songs: Song[];
  meta?: SongsMeta;
  verified?: boolean;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (response.status === 502 || text.trimStart().startsWith("<")) {
      throw new Error(
        "Admin API is not reachable. Ensure Docker was rebuilt and ADMIN_PASSWORD is set in .env.",
      );
    }
    throw new Error("Server returned an unexpected response.");
  }
  return JSON.parse(text) as T;
}

async function login(password: string): Promise<string> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await readApiJson<{ token?: string; error?: string }>(response);
  if (!response.ok || !body.token) {
    throw new Error(body.error ?? "Login failed.");
  }
  return body.token;
}

async function saveYoutubeIds(token: string, updates: Array<{ id: string; youtubeId: string | null }>) {
  const response = await fetch("/api/admin/youtube-ids", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ updates }),
    cache: "no-store",
  });
  const body = await readApiJson<{ error?: string; songs?: Song[]; meta?: SongsMeta; verified?: boolean }>(
    response,
  );
  if (!response.ok) {
    throw new Error(body.error ?? "Save failed.");
  }
  return { songs: body.songs ?? [], meta: body.meta, verified: body.verified } satisfies SaveResult;
}

function formatMeta(meta: SongsMeta | null) {
  if (!meta?.mtime) return null;
  const when = new Date(meta.mtime).toLocaleString();
  return `Server file: ${meta.path} · last updated ${when}`;
}

export function AdminPage() {
  const navigate = useNavigate();
  const { refresh: refreshCatalog } = useSongs();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<SongsMeta | null>(null);
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [songs, setSongs] = useState<EditableSong[]>([]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/songs?_=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load songs.");
        const data = await readApiJson<{ songs: Song[]; meta?: SongsMeta }>(response);
        if (!cancelled) {
          setFileMeta(data.meta ?? null);
          setSongs(
            data.songs.map((song) => ({
              ...song,
              draftYoutubeId: song.youtubeId ?? "",
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setLoginError(error instanceof Error ? error.message : "Could not load songs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleSongs = useMemo(() => {
    if (filter === "missing") {
      return songs.filter((song) => !song.draftYoutubeId.trim());
    }
    return songs;
  }, [filter, songs]);

  const changedCount = useMemo(
    () =>
      songs.filter((song) => (song.youtubeId ?? "") !== song.draftYoutubeId.trim()).length,
    [songs],
  );

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const nextToken = await login(password);
      sessionStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      setPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSongs([]);
    setSaveMessage(null);
  }

  async function handleSave() {
    if (!token) return;
    const updates = songs
      .filter((song) => (song.youtubeId ?? "") !== song.draftYoutubeId.trim())
      .map((song) => ({
        id: song.id,
        youtubeId: song.draftYoutubeId.trim() || null,
      }));

    if (!updates.length) {
      setSaveMessage("No changes to save.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const { songs: saved, meta, verified } = await saveYoutubeIds(token, updates);
      const byId = new Map(saved.map((song) => [song.id, song]));
      setSongs((current) =>
        current.map((song) => {
          const next = byId.get(song.id);
          if (!next) return song;
          return {
            ...song,
            ...next,
            draftYoutubeId: next.youtubeId ?? "",
          };
        }),
      );

      const check = await fetch(`/api/songs?_=${Date.now()}`, { cache: "no-store" });
      if (!check.ok) throw new Error("Saved, but could not re-read the server file.");
      const checked = await readApiJson<{ songs: Song[]; meta?: SongsMeta }>(check);
      setFileMeta(checked.meta ?? meta ?? null);

      const checkedById = new Map(checked.songs.map((song) => [song.id, song]));
      const failed = updates.filter((update) => {
        const song = checkedById.get(update.id);
        const expected = update.youtubeId?.trim() ?? "";
        const actual = song?.youtubeId ?? "";
        return expected !== actual;
      });

      if (!verified || failed.length) {
        throw new Error(
          "Save did not stick on the server. Redeploy with docker compose (./data:/data volume) and check container logs.",
        );
      }

      setSaveMessage(
        `Saved ${updates.length} YouTube ID${updates.length === 1 ? "" : "s"}${meta?.mtime ? ` · verified ${new Date(meta.mtime).toLocaleTimeString()}` : ""}.`,
      );
      await refreshCatalog();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <div className="screen screen--dark">
        <div className="screen__content screen__content--center admin-auth">
          <h1 className="screen-title">Admin</h1>
          <p className="screen-copy">Enter the admin password to edit YouTube IDs.</p>
          <form className="admin-auth__form" onSubmit={handleLogin}>
            <label className="admin-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError ? <p className="error-text">{loginError}</p> : null}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/")}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--dark screen--admin">
      <div className="screen__content admin-layout">
        <header className="admin-header">
          <div>
            <h1 className="screen-title">YouTube IDs</h1>
            <p className="screen-copy">
              {songs.length} songs · {changedCount} unsaved change{changedCount === 1 ? "" : "s"}
            </p>
            {fileMeta ? <p className="screen-copy admin-meta">{formatMeta(fileMeta)}</p> : null}
          </div>
          <div className="admin-header__actions">
            <button type="button" className="btn btn--ghost" onClick={() => navigate("/")}>
              Home
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="admin-toolbar">
          <label className="admin-filter">
            <span>Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "missing")}>
              <option value="all">All songs</option>
              <option value="missing">Missing YouTube ID</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || changedCount === 0}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {saveMessage ? <p className="admin-message">{saveMessage}</p> : null}
        {loading ? <p className="admin-message">Loading songs…</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Year</th>
                <th>YouTube ID</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {visibleSongs.map((song) => {
                const draft = song.draftYoutubeId.trim();
                const changed = (song.youtubeId ?? "") !== draft;
                return (
                  <tr key={song.id} className={changed ? "admin-table__row--changed" : undefined}>
                    <td>{song.id}</td>
                    <td>{song.title}</td>
                    <td>{song.artist}</td>
                    <td>{song.year}</td>
                    <td>
                      <input
                        className="admin-input"
                        value={song.draftYoutubeId}
                        onChange={(event) =>
                          setSongs((current) =>
                            current.map((entry) =>
                              entry.id === song.id
                                ? { ...entry, draftYoutubeId: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="YouTube video ID"
                        spellCheck={false}
                      />
                    </td>
                    <td>
                      {draft ? (
                        <a
                          className="admin-link"
                          href={`https://www.youtube.com/watch?v=${encodeURIComponent(draft)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
