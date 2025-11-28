"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - onScan(decodedText) : function(decodedText) -> void
 * - autoStart (bool) : if true, attempt auto start when camera list available
 */
export default function QrScanner({ onScan, autoStart = false }) {
  const readerId = "html5qr-reader";
  const html5QrRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load script once
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.Html5Qrcode) {
      setScriptLoaded(true);
      initCameras();
      return;
    }

    // load script and wait for it
    const s = document.createElement("script");
    s.src = "https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js";
    s.async = true;
    s.onload = () => {
      setScriptLoaded(true);
      initCameras();
    };
    s.onerror = () => {
      setErrorMsg("Failed to load html5-qrcode library.");
      console.error("Failed to load html5-qrcode");
    };
    document.body.appendChild(s);

    return () => {
      // no special cleanup of script tag
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init camera list
  async function initCameras() {
    setErrorMsg("");
    if (!window.Html5Qrcode || !window.Html5Qrcode.getCameras) {
      // sometimes the library isn't immediately ready — wait a moment then retry
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!window.Html5Qrcode || !window.Html5Qrcode.getCameras) {
      setErrorMsg("Camera API unavailable in this browser.");
      return;
    }

    try {
      const cams = await window.Html5Qrcode.getCameras();
      if (!cams || cams.length === 0) {
        setErrorMsg("No cameras found. Make sure the device has a camera and camera permissions are allowed.");
        setCameras([]);
        return;
      }
      setCameras(cams);
      // pick back/rear camera if available
      const preferred = cams.find(c => /back|rear|environment/i.test(c.label)) || cams[0];
      setSelectedCameraId(preferred.id);
      if (autoStart) {
        // wait a tick then start
        setTimeout(() => startScanner(preferred.id).catch(()=>{}), 200);
      }
    } catch (err) {
      console.error("getCameras error", err);
      setErrorMsg("Could not access camera list. Permission denied or browser blocked.");
    }
  }

  // Start scanner with deviceId or fallback
  async function startScanner(deviceId) {
    setErrorMsg("");
    if (!scriptLoaded) {
      setErrorMsg("Scanner library not yet loaded.");
      return;
    }

    if (scanning) return;

    // create instance
    try {
      const html5Qr = new window.Html5Qrcode(readerId, /* verbose= */ false);
      html5QrRef.current = html5Qr;

      const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 }
      };

      // If deviceId provided, try to use it (preferred)
      if (deviceId) {
        try {
          await html5Qr.start(deviceId, config,
            (decodedText) => { try { onScan && onScan(decodedText); } catch(e){ console.error(e); } },
            (errorMsg) => { /* ignore scanning errors */ }
          );
          setScanning(true);
          setErrorMsg("");
          return;
        } catch (err) {
          console.warn("start with deviceId failed, will fallback to facingMode", err);
          // fallthrough to facingMode
        }
      }

      // fallback to facingMode environment
      try {
        await html5Qr.start({ facingMode: "environment" }, config,
          (decodedText) => { try { onScan && onScan(decodedText); } catch(e){ console.error(e); } },
          (errorMsg) => { /* ignore scanning errors */ }
        );
        setScanning(true);
        setErrorMsg("");
        return;
      } catch (err2) {
        console.error("start with facingMode failed", err2);
        setErrorMsg("Unable to start camera. Please ensure camera permission is allowed and the site is served over HTTPS (or localhost).");
        try { await html5Qr.clear(); } catch(e) {}
        html5QrRef.current = null;
        setScanning(false);
      }
    } catch (createErr) {
      console.error("Failed to create Html5Qrcode:", createErr);
      setErrorMsg("Scanner initialization failed.");
    }
  }

  // Stop scanner and free camera
  async function stopScanner() {
    setErrorMsg("");
    const html5Qr = html5QrRef.current;
    if (!html5Qr) {
      setScanning(false);
      return;
    }
    try {
      await html5Qr.stop(); // stops camera
    } catch (e) {
      // ignore
    }
    try {
      await html5Qr.clear(); // clears UI and frees resources
    } catch (e) {
      // ignore
    }
    html5QrRef.current = null;
    setScanning(false);
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div id={readerId} style={{ width: 320, margin: "0 auto", background: "#000" }} />
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            // Ensure this action is triggered by a user gesture
            if (scanning) stopScanner();
            else startScanner(selectedCameraId).catch(()=>{});
          }}
          style={{ padding: "8px 12px", marginRight: 8 }}
        >
          {scanning ? "Stop Scanning" : "Start Scanning"}
        </button>

        {cameras && cameras.length > 1 && (
          <select
            value={selectedCameraId}
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

      <div style={{ marginTop: 8, color: errorMsg ? "crimson" : "#666", minHeight: 18 }}>
        {errorMsg || (scriptLoaded ? (scanning ? "Scanning..." : "Ready to scan") : "Loading scanner...")}
      </div>

      <small style={{ display: "block", marginTop: 6, color: "#666" }}>
        Notes: You must allow camera permission. On iOS Safari the page must be HTTPS (or localhost) and you must tap Start to grant permissions.
      </small>
    </div>
  );
}
