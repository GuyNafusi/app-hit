"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - onScan(decodedText) : called once per successful decode
 * - autoStart (bool) : if true, start scanning immediately on mount
 */
export default function QrScanner({ onScan, autoStart = true }) {
  const scannerRef = useRef(null); // Html5Qrcode instance
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const readerId = "html5qr-reader";

  useEffect(() => {
    // load html5-qrcode script from CDN if needed
    if (typeof window === "undefined") return;

    if (!window.Html5Qrcode) {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js";
      s.async = true;
      s.onload = () => initCameras();
      s.onerror = () => console.error("Failed to load html5-qrcode script");
      document.body.appendChild(s);
    } else {
      initCameras();
    }

    // cleanup on unmount
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoStart && selectedCameraId) {
      startScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  async function initCameras() {
    try {
      // wait until Html5Qrcode available
      if (!window.Html5Qrcode || !window.Html5Qrcode.getCameras) {
        // sometimes getCameras isn't exposed immediately; slight delay then try again
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!window.Html5Qrcode || !window.Html5Qrcode.getCameras) {
        console.warn("Html5Qrcode not available to get cameras");
        return;
      }
      const cams = await window.Html5Qrcode.getCameras();
      setCameras(cams || []);
      if (cams && cams.length) {
        // prefer environment (rear) camera if available
        const back = cams.find(c => /back|rear|environment/i.test(c.label));
        setSelectedCameraId((back && back.id) || cams[0].id);
      }
    } catch (err) {
      console.warn("Camera init error", err);
    }
  }

  async function startScanner() {
    if (!window.Html5Qrcode) {
      console.error("Html5Qrcode library missing");
      return;
    }

    // if already scanning, do nothing
    if (scanning) return;

    const html5qr = new window.Html5Qrcode(readerId, /* verbose= */ false);
    scannerRef.current = html5qr;

    const chosenCameraId = selectedCameraId;

    const config = {
      fps: 10,
      qrbox: { width: 300, height: 300 },
      // prefer back camera via facingMode if id isn't available
      // note: when passing deviceId to start(), facingMode is ignored
    };

    try {
      await html5qr.start(
        chosenCameraId || { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          // On successful scan:
          try {
            onScan && onScan(decodedText);
          } catch (e) {
            console.error("onScan handler error", e);
          }
          // keep scanning for more scans (continuous mode). Do NOT stop automatically here.
        },
        (errorMessage) => {
          // scanning errors (ignored)
        }
      );
      setScanning(true);
    } catch (startErr) {
      console.error("Failed to start scanner:", startErr);
      try {
        // attempt fallback: try without device id
        await html5qr.start({ facingMode: "environment" }, config,
          (decodedText) => onScan && onScan(decodedText));
        setScanning(true);
      } catch (err) {
        console.error("Fallback start failed", err);
        html5qr.clear().catch(()=>{});
        setScanning(false);
      }
    }
  }

  async function stopScanner() {
    const html5qr = scannerRef.current;
    if (!html5qr) {
      setScanning(false);
      return;
    }
    try {
      await html5qr.stop();     // stop camera
    } catch (e) {
      // some browsers may throw if camera already stopped - ignore
    }
    try {
      await html5qr.clear();    // clear UI and free resources
    } catch (e) {}
    scannerRef.current = null;
    setScanning(false);
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div id={readerId} style={{ width: 320, margin: "0 auto" }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => (scanning ? stopScanner() : startScanner())} style={{ padding: "8px 12px", marginRight: 8 }}>
          {scanning ? "Stop Scanning" : "Start Scanning"}
        </button>

        {cameras && cameras.length > 1 && (
          <select
            value={selectedCameraId || ""}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            style={{ padding: "8px 10px" }}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || c.id}
              </option>
            ))}
          </select>
        )}
      </div>
      <small style={{ display: "block", marginTop: 8, color: "#666" }}>
        Tip: Allow camera access and pick the back camera for best results on phones.
      </small>
    </div>
  );
}
