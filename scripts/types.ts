export interface Song {
  id: string;
  title: string;
  artist: string;
  movie?: string;
  year: number;
  spotifyUri?: string;
  youtubeId?: string;
}

export interface SongsFile {
  playlistUrl: string;
  baseUrl: string;
  songs: Song[];
}
