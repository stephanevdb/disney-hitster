import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          height: string;
          width: string;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const existing = document.getElementById("youtube-iframe-api");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    window.onYouTubeIframeAPIReady = () => resolve();
  });

  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
}

export function YouTubePlayer({
  videoId,
  playing,
  onPlayingChange,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const elementId = `yt-player-${videoId}`;

    async function init() {
      await loadYouTubeApi();
      if (cancelled || !containerRef.current || !window.YT) return;

      containerRef.current.id = elementId;
      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(elementId, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (event) => {
            if (event.data === window.YT!.PlayerState.PLAYING) {
              onPlayingChange(true);
            } else if (event.data === window.YT!.PlayerState.PAUSED) {
              onPlayingChange(false);
            } else if (event.data === window.YT!.PlayerState.ENDED) {
              onPlayingChange(false);
              onEnded();
            }
          },
        },
      });
    }

    setReady(false);
    init();

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, onPlayingChange, onEnded]);

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (playing) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [playing, ready]);

  return (
    <div
      ref={containerRef}
      className="yt-player-host"
      aria-hidden="true"
    />
  );
}
