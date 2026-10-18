"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { decodeLaundryQrImage } from "@/lib/laundry/qr-image";
import { useRouter } from "next/navigation";
import { resolveOwnerScannedCard } from "@/app/admin/visits/actions";

type CameraControls = { stop: () => void };
const MAX_GALLERY_BYTES = 12 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
]);
const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i;

function acceptableScreenshot(file: File) {
  if (file.size === 0 || file.size > MAX_GALLERY_BYTES) return false;
  // Some Android gallery providers do not report MIME type.
  if (!file.type) return SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
  return SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase());
}

export default function ScanCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<CameraControls | null>(null);
  const cameraAttemptRef = useRef(0);
  const scanLock = useRef(false);
  const workInProgress = useRef(false);
  const imageAttempt = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      imageAttempt.current?.abort();
      cameraAttemptRef.current += 1;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  const stop = () => {
    cameraAttemptRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setRunning(false);
    setStarting(false);
  };

  const onDecoded = async (text: string) => {
    // QR resolution is read-only; recording requires the separate explicit owner form.
    if (scanLock.current || !aliveRef.current) return;
    scanLock.current = true;
    stop();
    setLoading(true);
    setError("");

    try {
      const member = await resolveOwnerScannedCard(text);
      if (!aliveRef.current) return;
      if (!member) {
        setError("Kartu tidak ditemukan atau sudah tidak aktif. Coba gambar lain atau cari member manual.");
        scanLock.current = false;
      } else {
        router.push("/admin/members/" + member.id);
        // Leave scanLock set until navigation unmounts this scanner.
      }
    } catch {
      if (aliveRef.current) {
        setError("Gagal memeriksa kartu. Periksa koneksi dan coba lagi.");
        scanLock.current = false;
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  const start = async () => {
    if (starting || loading || workInProgress.current || running) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di browser ini. Gunakan galeri atau cari member manual.");
      return;
    }

    const attempt = ++cameraAttemptRef.current;
    setStarting(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (!videoRef.current || !aliveRef.current || cameraAttemptRef.current !== attempt) return;

      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, control) => {
        if (result && !scanLock.current) {
          control.stop();
          void onDecoded(result.getText());
        }
      });

      if (!aliveRef.current || cameraAttemptRef.current !== attempt) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setRunning(true);
    } catch {
      if (aliveRef.current && cameraAttemptRef.current === attempt) {
        setError("Kamera tidak dapat dibuka. Izinkan kamera atau pilih screenshot dari galeri.");
        setRunning(false);
      }
    } finally {
      if (aliveRef.current && cameraAttemptRef.current === attempt) setStarting(false);
    }
  };

  const scanScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Allow selecting exactly the same screenshot after an error.
    event.currentTarget.value = "";
    if (!file || !aliveRef.current || workInProgress.current || loading || scanLock.current) return;

    if (!acceptableScreenshot(file)) {
      setError("Gunakan gambar PNG, JPG, WebP, GIF, atau AVIF dengan ukuran maksimal 12 MB.");
      return;
    }

    // A screenshot is decoded entirely on this device; the image is not uploaded.
    stop();
    setError("");
    setLoading(true);
    workInProgress.current = true;
    const attempt = new AbortController(); imageAttempt.current = attempt;
    try {
      const text = await decodeLaundryQrImage(file, attempt.signal);
      if (!aliveRef.current) return;
      await onDecoded(text);
    } catch {
      if (aliveRef.current) {
        setError("QR tidak terbaca dari gambar. Coba screenshot lebih jelas, scan dengan kamera, atau cari member manual.");
      }
    } finally {
      if (imageAttempt.current === attempt) imageAttempt.current = null;
      workInProgress.current = false;
      if (aliveRef.current && !scanLock.current) setLoading(false);
    }
  };

  return (
    <section className="owner-scanner" aria-labelledby="scan-title">
      <div className="owner-scanner-heading">
        <h2 id="scan-title">Scan Kartu</h2>
        <p>Arahkan kamera ke QR atau pilih foto kartu dari galeri. Scan hanya membuka data member, bukan mencatat transaksi.</p>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="owner-scan-actions">
        {running ? (
          <button type="button" onClick={stop} className="admin-logout">Tutup Kamera</button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={starting || loading} className="member-add">
            {starting ? "Membuka Kamera…" : "Buka Kamera"}
          </button>
        )}
        <input
          ref={galleryInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          aria-label="Pilih screenshot QR dari galeri"
          onChange={(event) => void scanScreenshot(event)}
          tabIndex={-1}
        />
        <button
          type="button"
          className="admin-logout owner-gallery-button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={loading || starting}
        >
          {loading ? "Memeriksa QR…" : "Pilih Foto QR"}
        </button>
        <Link href="/admin/members" className="admin-logout">Cari Member Manual</Link>
      </div>
      <div className={"owner-camera" + (running || starting ? " owner-camera-active" : "")}>
        <video ref={videoRef} autoPlay muted playsInline aria-label="Pratinjau kamera untuk scan kartu" />
        {!running && !starting && <span className="owner-camera-placeholder">Pilih kamera atau foto QR dari galeri</span>}
        {starting && <span className="owner-camera-placeholder">Membuka kamera…</span>}
      </div>

      <p className="owner-gallery-hint" role="status">
        Pilih screenshot dari HP. Gambar diperiksa di perangkat, tidak diunggah ke server.
      </p>


    </section>
  );
}
