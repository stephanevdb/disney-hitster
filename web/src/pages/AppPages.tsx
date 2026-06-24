import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HitsterLogo } from "../components/HitsterLogo";
import { NeonStage } from "../components/NeonStage";
import { Player } from "../components/Player";
import songsData from "../data/songs.json";
import { findSongById } from "../lib/songs";
import type { SongsFile } from "../lib/songs";

const catalog = songsData as SongsFile;

export function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const song = id ? findSongById(id, catalog.songs) : undefined;

  if (!song) {
    return (
      <div className="screen screen--dark">
        <NeonStage />
        <div className="screen__content screen__content--center">
          <HitsterLogo size="sm" />
          <h1 className="screen-title">Unknown card</h1>
          <p className="screen-copy">Card &quot;{id}&quot; was not found in this Disney Hitster set.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate("/")}>
            Home
          </button>
        </div>
      </div>
    );
  }

  return <Player song={song} />;
}

export function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let scanner: import("qr-scanner").default | null = null;
    let cancelled = false;

    async function start() {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (!videoRef.current || cancelled) return;

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const url = result.data;
            const match = url.match(/\/play\/(\d{3})(?:\/)?$/);
            if (match) {
              scanner?.stop();
              navigate(`/play/${match[1]}`);
              return;
            }
            setError("QR code is not a Disney Hitster card.");
          },
          {
            highlightScanRegion: true,
            preferredCamera: "environment",
          },
        );

        await scanner.start();
        if (!cancelled) setScanning(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not access camera. Use HTTPS or scan with your phone camera.",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [navigate]);

  return (
    <div className="screen screen--scan">
      <div className="scan-camera">
        <video ref={videoRef} className="scan-camera__video" />
        {!scanning && !error ? <p className="scan-camera__status">Starting camera…</p> : null}
        <div className="scan-frame" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="scan-overlay">
        <header className="scan-header">
          <HitsterLogo size="sm" subtitle="Scan the QR code" />
        </header>

        <p className="scan-hint">Line up the code inside the frame</p>

        {error ? <p className="error-text scan-error">{error}</p> : null}

        <div className="scan-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/")}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="screen screen--home">
      <NeonStage active />
      <div className="screen__content home-layout">
        <div className="home-hero">
          <p className="home-eyebrow">Custom expansion pack</p>
          <HitsterLogo subtitle="The music party game — Disney edition" />
          <p className="home-copy">
            Scan a card to play songs without spoilers. Works with your existing Hitster board,
            tokens, and timeline.
          </p>
          <span className="home-badge">{catalog.songs.length} songs</span>
        </div>

        <div className="home-actions">
          <button type="button" className="btn btn--cta" onClick={() => navigate("/scan")}>
            Scan card
          </button>
        </div>
      </div>
    </div>
  );
}
