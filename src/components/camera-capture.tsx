"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_SIDE = 2400;

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isStarting, setIsStarting] = React.useState(true);

  const stopStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsStarting(false);
      } catch (err) {
        if (cancelled) return;
        setIsStarting(false);
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            setError("Permiso de cámara denegado. Activa el acceso en la configuración del navegador.");
          } else if (err.name === "NotFoundError") {
            setError("No se encontró ninguna cámara en este dispositivo.");
          } else {
            setError(err.message);
          }
        } else {
          setError("No se pudo acceder a la cámara.");
        }
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no soporta acceso a la cámara.");
      setIsStarting(false);
      return;
    }

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let drawWidth = video.videoWidth;
    let drawHeight = video.videoHeight;

    if (drawWidth > MAX_SIDE || drawHeight > MAX_SIDE) {
      const scale = MAX_SIDE / Math.max(drawWidth, drawHeight);
      drawWidth = Math.round(drawWidth * scale);
      drawHeight = Math.round(drawHeight * scale);
    }

    canvas.width = drawWidth;
    canvas.height = drawHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, drawWidth, drawHeight);

    let quality = 0.92;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) {
      setError("No se pudo capturar la imagen.");
      return;
    }

    if (blob.size > MAX_FILE_SIZE) {
      quality = 0.75;
      const resized = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!resized) {
        setError("No se pudo comprimir la imagen.");
        return;
      }
      const url = URL.createObjectURL(resized);
      setPreviewUrl(url);
      stopStream();
      onCapture(new File([resized], "captura.jpg", { type: "image/jpeg" }));
      return;
    }

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    stopStream();
    onCapture(new File([blob], "captura.jpg", { type: "image/jpeg" }));
  }

  function handleRetake() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    startStreamAgain();
  }

  async function startStreamAgain() {
    try {
      setIsStarting(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsStarting(false);
    } catch (err) {
      setIsStarting(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo reiniciar la cámara.");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain"
          style={{ display: previewUrl ? "none" : "block" }}
        />
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Captura"
            className="h-full w-full object-contain"
          />
        ) : null}
        {isStarting && !error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-sm text-white/80">Iniciando cámara...</p>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="max-w-sm rounded-lg bg-white/10 p-6 text-center backdrop-blur-sm">
              <p className="text-sm text-white">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center justify-center gap-4 bg-black/80 px-4 py-5">
        {error ? (
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cerrar
          </Button>
        ) : previewUrl ? (
          <>
            <Button variant="outline" size="lg" onClick={handleRetake} className="border-white/30 text-white hover:bg-white/10">
              Reintentar
            </Button>
            <Button variant="primary" size="lg" onClick={onClose}>
              Usar foto
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={onClose} className="border-white/30 text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCapture}
              disabled={isStarting}
            >
              Capturar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
