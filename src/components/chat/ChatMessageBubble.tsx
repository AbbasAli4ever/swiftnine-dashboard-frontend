"use client";

import { LuCheckCheck, LuDownload, LuFile, LuForward } from "react-icons/lu";
import type { MockMessage } from "./mockChatData";

/**
 * One message in the thread. Handles the three shapes the mock covers — text,
 * file card, and image — since they share the same bubble chrome, alignment,
 * and timestamp/receipt footer.
 */
export default function ChatMessageBubble({ message }: { message: MockMessage }) {
  const { kind, body, time, outgoing, forwarded, read, file } = message;

  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[min(68%,32rem)]">
        {forwarded && (
          <p className="mb-1 flex items-center gap-1 text-[11px] italic text-gray-400">
            <LuForward className="h-3 w-3" />
            Forwarded
          </p>
        )}

        <div
          className={`rounded-2xl px-3 py-2 ${
            outgoing
              ? "bg-brand-500/10 dark:bg-brand-500/20"
              : "border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          }`}
        >
          {kind === "file" && file && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <LuFile className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-900 dark:text-gray-100">
                  {file.name}
                </span>
                <span className="block text-xs text-gray-400">
                  {file.type} • {file.size}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Download ${file.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
              >
                <LuDownload className="h-4 w-4" />
              </button>
            </div>
          )}

          {kind === "image" && (
            /* Placeholder block rather than a real <img> — the mock has no
               asset, and a broken image would read as a bug. */
            <div className="h-40 w-56 rounded-lg bg-gray-200 dark:bg-gray-700" />
          )}

          {kind === "text" && body && (
            <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
              {body}
            </p>
          )}

          <p
            className={`mt-1 flex items-center gap-1 text-[10px] text-gray-400 ${
              outgoing ? "justify-end" : "justify-start"
            }`}
          >
            {time}
            {outgoing && read && (
              <LuCheckCheck className="h-3 w-3 text-brand-500" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
