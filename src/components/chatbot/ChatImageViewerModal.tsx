"use client";

import { useEffect } from "react";
import { LuDownload, LuX } from "react-icons/lu";

interface Props {
  isOpen: boolean;
  url: string | null;
  fileName: string;
  onClose: () => void;
}

async function triggerDownload(url: string, fileName: string) {
  const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&fileName=${encodeURIComponent(fileName)}`;
  const a = document.createElement("a");
  a.href = proxyUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ChatImageViewerModal({ isOpen, url, fileName, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !url) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName}
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <div className="absolute -right-3 -top-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void triggerDownload(url, fileName);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
            title="Download"
          >
            <LuDownload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
            title="Close"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/70">{fileName}</p>
      </div>
    </div>
  );
}
