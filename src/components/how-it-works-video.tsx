"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Autoplay muto SOLO quando il video entra nel viewport (mai al
// caricamento della pagina) — Intersection Observer invece di un
// semplice `autoPlay`, che partirebbe subito indipendentemente dallo
// scroll. Pausa quando esce dal viewport, così non continua a girare
// (e a consumare banda) fuori vista.
//
// `muted` va sempre impostato anche via ref, non solo come prop React:
// la proprietà DOM `muted` di <video>/<audio> non si sincronizza in modo
// affidabile con gli aggiornamenti della prop JSX dopo il mount in tutti
// i browser — senza il ref, il pulsante per riattivare l'audio
// smetterebbe di funzionare al secondo click in alcuni casi.
export default function HowItWorksVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay bloccato dal browser (raro con muted+playsInline,
            // ma non impossibile) — l'utente può comunque avviarlo dai
            // controlli nativi, nessun errore da gestire qui.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border">
      <video
        ref={videoRef}
        src="/videos/come-funziona.mp4"
        poster="/videos/come-funziona-poster.jpg"
        muted
        playsInline
        loop={false}
        className="w-full aspect-video block"
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Attiva audio" : "Disattiva audio"}
        className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-full p-2.5 shadow-md hover:bg-background transition-colors"
      >
        {muted ? (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
