export interface Song {
  id: string;
  title: string;
  artist: string;
  movie: string;
  year: number;
  spotifyUri?: string;
  youtubeId?: string;
}

export interface SongsFile {
  playlistUrl: string;
  baseUrl: string;
  songs: Song[];
}

export function findSongById(id: string, songs: Song[]): Song | undefined {
  return songs.find((song) => song.id === id);
}

export function findSongByPlayUrl(
  url: string,
  songs: Song[],
  baseUrl: string,
): Song | undefined {
  const normalized = baseUrl.replace(/\/$/, "");
  const match = url.match(/\/play\/(\d{3})(?:\/)?$/);
  if (!match) return undefined;
  const id = match[1];
  if (url.startsWith(normalized) || url.includes(`/play/${id}`)) {
    return findSongById(id, songs);
  }
  return findSongById(id, songs);
}
