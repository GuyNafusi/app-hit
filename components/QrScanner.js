"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

export default function QrScanner({ onScan }) {
  const scannerRef = useRef(null);
  const [scanner, setScanner] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!scanner && typeof window !== "undefined") {
      const camScanner = new Html5Qrcode("qr-reader");
      setScanner(camScanner);
    }
  }, [scanner]);

  const startScanner = async () => {
    if (!scanner) return;

    try {
      setIsScanning(true);

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        }
      );
    } catch (err) {
      console.error("Camera start error:", err);
      alert("Camera access failed. Allow camera permissions.");
    }
  };

  const stopScanner = async () => {
    if (!scanner) return;

    await scanner.stop();
    setIsScanning(false);
  };

  return (
    <div className="flex flex-col gap-2 items-center">
      <div id="qr-reader" className="w-[300px] h-[300px]" />

      {!isScanning ? (
        <button
          onClick={startScanner}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Start Scanning
        </button>
      ) : (
        <button
          onClick={stopScanner}
          className="px-4 py-2 bg-red-600 text-white rounded-lg"
        >
          Stop Scanning
        </button>
      )}
    </div>
  );
}
