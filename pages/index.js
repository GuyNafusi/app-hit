import Head from "next/head";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const QrScanner = dynamic(() => import("../components/QrScanner"), { ssr: false });

export default function Home() {
  const [track, setTrack] = useState(null);
  const [status, setStatus] = useState("Ready — press Start Scanning and scan a QR.");
  const [showDetails, setShowDetails] = useState(false); // Hide details by default
  const [playingPreview, setPlayingPreview] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => setPlayingPreview(false);
    audioRef.current.onpause = () => setPlayingPreview(false);
    audioRef.current.onplay = () => setPlayingPreview(true);

    return () => {
      try {
        audioRef.current.pause();
      } catch (e) {}
    };
  }, []);

  // Called by QrScanner when a QR is detected
  async function handleScan(decodedText) {
    // prevent double rapid scans
    setStatus("Scanned — processing...");
    try {
      const id = extractAppleTrackId(decodedText);
      if (id) {
        await lookupById(id);
        return;
      }
      // If scanned text isn't apple id, try to search by plain text (last resort)
      await searchByText(decodedText);
    } catch (e) {
      console.error(e);
      setStatus("Scan error");
    }
  }

  function extractAppleTrackId(text) {
    if (!text) return null;
    try {
      // match i=12345 or /id12345 or plain numeric
      const iParam = text.match(/[?&]i=(\d+)/);
      if (iParam) return iParam[1];
      const idPath = text.match(/\/id(\d+)/);
      if (idPath) return idPath[1];
      const numeric = text.match(/^(\d{6,})$/);
      if (numeric) return numeric[1];
    } catch (e) {}
    return null;
  }

  async function lookupById(id) {
    setTrack(null);
    setShowDetails(false); // hide details until user chooses to reveal
    setStatus("Looking up track id " + id + " …");
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song`);
      const json = await res.json();
      if (json.resultCount && json.results.length) {
        const item = json.results[0];
        setTrack(normalizeItunesItem(item));
        setStatus("Found: " + item.trackName + " — tap Play");
      } else {
        setStatus("No results for id: " + id);
      }
    } catch (e) {
      console.error(e);
      setStatus("Lookup failed");
    }
  }

  async function searchByText(text) {
    setTrack(null);
    setShowDetails(false);
    setStatus("Searching iTunes for scanned text…");
    try {
      const q = encodeURIComponent(text);
      const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`);
      const json = await res.json();
      if (json.resultCount && json.results.length) {
        const item = json.results[0];
        setTrack(normalizeItunesItem(item));
        setStatus("Found by text: " + item.trackName);
      } else {
        setStatus("No search results for scanned text");
      }
    } catch (e) {
      console.error(e);
      setStatus("Search failed");
    }
  }

  function normalizeItunesItem(item) {
    return {
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName,
      artwork: (item.artworkUrl100 || item.artworkUrl60 || "").replace(/100x100|60x60/, "600x600"),
      previewUrl: item.previewUrl || null,
      itunesUrl: item.trackViewUrl || item.collectionViewUrl || null
    };
  }

  function playPreview() {
    if (!track) return alert("No track loaded");
    if (!track.previewUrl) return alert("Preview not available for this track");
    try {
      audioRef.current.src = track.previewUrl;
      audioRef.current.play();
      setPlayingPreview(true);
      setStatus("Playing preview 🎧");
    } catch (e) {
      console.error(e);
      alert("Playback failed. Some browsers require a user gesture — try tapping the Play Preview button again.");
    }
  }

  function stopPreview() {
    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingPreview(false);
      setStatus("Preview stopped");
    } catch (e) {}
  }

  return (
    <>
      <Head>
        <title>iTunes QR Preview — Scan Only</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 720, margin: "18px auto", padding: 12 }}>
        <h1 style={{ textAlign: "center" }}>iTunes QR Preview (Scan Only)</h1>
        <p style={{ color: "#444", textAlign: "center" }}>{status}</p>

        <section style={{ marginTop: 8 }}>
          <QrScanner onScan={handleScan} autoStart={false} />
        </section>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          {/* Hide/Show details before play */}
          <button
            onClick={() => setShowDetails(s => !s)}
            style={{ padding: "8px 12px", marginBottom: 8 }}
          >
            {showDetails ? "Hide Details Before Play" : "Reveal Details Before Play"}
          </button>
        </div>

        {track && (
          <section style={{ marginTop: 16, textAlign: "center", borderTop: "1px solid #eee", paddingTop: 16 }}>
            {/* If hidden, show placeholder box */}
            {!showDetails ? (
              <div style={{ width: 260, margin: "0 auto", padding: 18, borderRadius: 8, background: "#fafafa", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>Song scanned — details hidden</p>
                <p style={{ marginTop: 8, color: "#666" }}>Tap "Reveal Details Before Play" to see the song info.</p>
              </div>
            ) : (
              <>
                <img src={track.artwork} alt="art" style={{ width: 240, borderRadius: 8 }} />
                <h2 style={{ margin: "12px 0 4px" }}>{track.title}</h2>
                <p style={{ margin: 0 }}>{track.artist}</p>
                <p style={{ marginTop: 6, color: "#666" }}>{track.album}</p>
              </>
            )}

            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => {
                  if (playingPreview) stopPreview();
                  else playPreview();
                }}
                style={{ padding: "10px 14px", marginRight: 10 }}
              >
                {playingPreview ? "Stop Preview" : "Play Preview"}
              </button>

              {track.itunesUrl && (
                <a href={track.itunesUrl} target="_blank" rel="noreferrer">
                  <button style={{ padding: "10px 14px" }}>Open in iTunes / Apple Music</button>
                </a>
              )}
            </div>

            {!track.previewUrl && (
              <p style={{ color: "crimson", marginTop: 10 }}>
                Preview not available for this track.
              </p>
            )}
          </section>
        )}

        <footer style={{ marginTop: 28, color: "#666", fontSize: 13, textAlign: "center" }}>
          Tip: Use back/rear camera on phones for best scanning results. If a QR url contains <code>?i=TRACKID</code> or <code>/idTRACKID</code> it will be found reliably.
        </footer>
      </main>
    </>
  );
}
