"use client";

import { useState } from "react";
import {
  LuFile,
  LuPin,
  LuReply,
  LuSmilePlus,
  LuTrash2,
} from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import {
  formatTime,
  groupReactions,
  renderSystemText,
  renderWithMentions,
} from "@/lib/chat/format";
import type { ChatMessage } from "@/types/chat";

/** Emoji offered by the quick reaction bar. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

/**
 * One message in a thread — author, body, attachments, reactions, and the
 * hover actions.
 *
 * Channels and DMs share this: any member can post in either, so the author is
 * always shown rather than inferred from left/right alignment.
 */
export default function ChatMessageRow({
  message,
  selfUserId,
  resolveName,
  canModerate,
  onReact,
  onReply,
  onPin,
  onDelete,
}: {
  message: ChatMessage;
  selfUserId: string | undefined;
  /** Turns a user id into a display name for SYSTEM message text. */
  resolveName: (id: string) => string;
  /** Channel OWNER/ADMIN — gates pinning and deleting others' messages. */
  canModerate: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isOwn = Boolean(message.senderId && message.senderId === selfUserId);

  // System rows are notices, not messages — no bubble, no author, no actions.
  if (message.kind === "SYSTEM") {
    return (
      <p className="py-1 text-center text-xs text-gray-400">
        {renderSystemText(message.contentJson, resolveName)}
      </p>
    );
  }

  const reactions = groupReactions(message);

  return (
    <div className="group relative flex items-start gap-3 px-1 py-1.5">
      <ChatAvatar name={message.sender?.fullName ?? "?"} size={32} />

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {message.sender?.fullName ?? "Unknown"}
          </span>
          <span className="text-[11px] text-gray-400">
            {formatTime(message.createdAt)}
          </span>
          {message.isPinned && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
              <LuPin className="h-3 w-3" />
              Pinned
            </span>
          )}
        </p>

        {/* Quoted parent — replies are flat, so this never nests. */}
        {message.replyTo && (
          <div className="mt-1 border-l-2 border-gray-200 pl-2 dark:border-gray-700">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {message.replyTo.sender?.fullName ?? "Unknown"}
            </p>
            <p className="truncate text-xs text-gray-400">
              {message.replyTo.deletedAt
                ? "Message deleted"
                : message.replyTo.plaintext}
            </p>
          </div>
        )}

        {message.deletedAt ? (
          <p className="text-sm italic text-gray-400">Message deleted</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
            {renderWithMentions(message.plaintext, message.mentions)}
            {message.isEdited && (
              <span className="ml-1 text-[11px] text-gray-400">(edited)</span>
            )}
          </p>
        )}

        {message.attachments.length > 0 && !message.deletedAt && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) =>
              att.mimeType.startsWith("image/") && att.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={att.id}
                  src={att.url}
                  alt={att.fileName}
                  className="max-h-60 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                />
              ) : (
                <a
                  key={att.id}
                  /* `downloadUrl` carries Content-Disposition: attachment, so
                     the browser saves the file. A plain `<a download>` with
                     `url` would not — the S3 link is cross-origin, where the
                     download attribute is ignored. */
                  href={att.downloadUrl ?? att.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <LuFile className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="max-w-[200px] truncate">{att.fileName}</span>
                </a>
              )
            )}
          </div>
        )}

        {reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reactions.map((r) => {
              const mine = selfUserId
                ? r.userIds.includes(selfUserId)
                : false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(message.id, r.emoji)}
                  className={`flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors ${
                    mine
                      ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!message.deletedAt && (
        <div className="absolute right-2 top-0 hidden items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm group-hover:flex dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            aria-label="Add reaction"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LuSmilePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Reply"
            onClick={() => onReply(message)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LuReply className="h-4 w-4" />
          </button>
          {canModerate && (
            <button
              type="button"
              aria-label={message.isPinned ? "Unpin message" : "Pin message"}
              onClick={() => onPin(message)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LuPin className="h-4 w-4" />
            </button>
          )}
          {(isOwn || canModerate) && (
            <button
              type="button"
              aria-label="Delete message"
              onClick={() => onDelete(message)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {pickerOpen && (
        <div className="absolute right-2 top-9 z-10 flex gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(message.id, emoji);
                setPickerOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded text-base hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
