import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Song } from "../lib/songs";
import { HitsterLogo } from "./HitsterLogo";
import { NeonRings } from "./NeonRings";
import { NeonStage } from "./NeonStage";
import { YouTubePlayer } from "./YouTubePlayer";

type StartMode = "instant" | "countdown";

interface PlayerProps {
  song: Song;
}

export function Player({ song }: PlayerProps) {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startMode, setStartMode] = useState<StartMode>("instant");
  const [armed, setArmed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!song.youtubeId) return;
    setArmed(true);
    setCountdown(null);
    setPlaying(true);
  }, [song.id, song.youtubeId]);

  const stop = useCallback(() => {
    setPlaying(false);
    setArmed(false);
    setCountdown(null);
  }, []);

  const beginPlayback = useCallback(() => {
    if (!song.youtubeId) return;
    setArmed(true);
    if (startMode === "instant") {
      setPlaying(true);
      return;
    }
    setCountdown(3);
  }, [song.youtubeId, startMode]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setPlaying(true);
      setCountdown(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown((value) => (value === null ? null : value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  if (!song.youtubeId) {
    return (
      <div className="screen screen--dark">
        <NeonStage />
        <div className="screen__content screen__content--center">
          <HitsterLogo size="sm" />
          <p className="error-text">This card has no audio mapped yet.</p>
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--dark screen--player">
      <div className="neon-stage neon-stage--player-bg" aria-hidden="true">
        <div className="neon-stage__glow" />
      </div>
      <YouTubePlayer
        videoId={song.youtubeId}
        playing={playing}
        onPlayingChange={setPlaying}
        onEnded={stop}
      />

      <div className="screen__content player-layout">
        <header className="player-header">
          <HitsterLogo size="sm" subtitle="Guess the year" />
        </header>

        <div className="player-stage">
          <div className="player-orb-wrap">
            <NeonRings active={playing} className="player-orb-wrap__rings" />
            {countdown !== null ? (
              <p className="player-countdown" aria-live="polite">
                {countdown === 0 ? "Go!" : countdown}
              </p>
            ) : (
              <button
                type="button"
                className={`play-orb${playing ? " play-orb--playing" : ""}`}
                onClick={() => {
                  if (!armed) {
                    beginPlayback();
                    return;
                  }
                  setPlaying((value) => !value);
                }}
                aria-label={playing ? "Pause" : "Play"}
              >
                <span className="play-orb__pulse" />
                <span className="play-orb__icon">{playing ? "❚❚" : "▶"}</span>
              </button>
            )}
          </div>

          <p className="player-status">
            {countdown !== null
              ? "Get ready…"
              : playing
                ? "Now playing — no spoilers"
                : armed
                  ? "Paused"
                  : "Tap to play"}
          </p>
        </div>

        <footer className="player-footer">
          <div className="player-actions">
            {armed ? (
              <button type="button" className="btn btn--danger" onClick={stop}>
                Stop
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={beginPlayback}>
                Start
              </button>
            )}
            <button type="button" className="btn btn--secondary" onClick={() => navigate("/scan")}>
              Scan another
            </button>
          </div>

          <button
            type="button"
            className="settings-toggle"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
          >
            Playback options
          </button>

          {settingsOpen ? (
            <div className="settings-panel">
              <label className="settings-option">
                <input
                  type="radio"
                  name="startMode"
                  checked={startMode === "instant"}
                  onChange={() => setStartMode("instant")}
                />
                Instant start
              </label>
              <label className="settings-option">
                <input
                  type="radio"
                  name="startMode"
                  checked={startMode === "countdown"}
                  onChange={() => setStartMode("countdown")}
                />
                3 second countdown
              </label>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
