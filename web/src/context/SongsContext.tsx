import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import bundledSongs from "../data/songs.json";
import type { Song, SongsFile } from "../lib/songs";

interface SongsContextValue {
  catalog: SongsFile;
  loading: boolean;
  source: "api" | "bundled";
  refresh: () => Promise<void>;
}

const SongsContext = createContext<SongsContextValue | null>(null);

async function fetchCatalog(): Promise<SongsFile | null> {
  try {
    const response = await fetch(`/api/songs?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as SongsFile;
  } catch {
    return null;
  }
}

export function SongsProvider({ children }: { children: ReactNode }) {
  const fallback = useMemo(() => bundledSongs as SongsFile, []);
  const [catalog, setCatalog] = useState<SongsFile>(fallback);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "bundled">("bundled");

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchCatalog();
    if (data) {
      setCatalog(data);
      setSource("api");
    } else {
      setCatalog(fallback);
      setSource("bundled");
    }
    setLoading(false);
  }, [fallback]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      catalog,
      loading,
      source,
      refresh,
    }),
    [catalog, loading, source, refresh],
  );

  return <SongsContext.Provider value={value}>{children}</SongsContext.Provider>;
}

export function useSongs() {
  const context = useContext(SongsContext);
  if (!context) {
    throw new Error("useSongs must be used within SongsProvider");
  }
  return context;
}

export function useSongById(id: string | undefined): Song | undefined {
  const { catalog } = useSongs();
  if (!id) return undefined;
  return catalog.songs.find((song) => song.id === id);
}
