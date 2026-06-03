"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

// Route HLS through Next.js proxy in dev to bypass CloudFront CORS.
// In production the manifestUrl is used directly.
function resolveHlsSrc(manifestUrl: string): string {
  if (process.env.NODE_ENV === "development") {
    return `/api/hls-proxy?url=${encodeURIComponent(manifestUrl)}`;
  }
  return manifestUrl;
}

interface VideoPlayerProps {
  manifestUrl: string;
  lastPositionSeconds: number;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onPause: (currentTime: number, duration: number) => void;
  onSeeked: (currentTime: number, duration: number) => void;
  onEnded: (duration: number) => void;
}

export default function VideoPlayer({
  manifestUrl,
  lastPositionSeconds,
  onTimeUpdate,
  onPause,
  onSeeked,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Create the video element inside the container div
    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "auto",
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      sources: [{ src: resolveHlsSrc(manifestUrl), type: "application/x-mpegURL" }],
    });

    playerRef.current = player;

    // Seek to resume position once metadata is loaded
    player.on("loadedmetadata", () => {
      if (lastPositionSeconds > 0) {
        player.currentTime(lastPositionSeconds);
      }
    });

    player.on("timeupdate", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onTimeUpdate(ct, dur);
    });

    player.on("pause", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onPause(ct, dur);
    });

    player.on("seeked", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onSeeked(ct, dur);
    });

    player.on("ended", () => {
      const dur = player.duration() ?? 0;
      onEnded(dur);
    });

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  // Only re-initialize when manifestUrl changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestUrl]);

  return (
    <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg">
      <div data-vjs-player>
        <div ref={videoRef} />
      </div>
    </div>
  );
}
