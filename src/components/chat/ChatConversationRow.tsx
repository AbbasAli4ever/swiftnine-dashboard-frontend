"use client";

import { LuCheckCheck } from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import type { MockConversation } from "./mockChatData";

/**
 * One row in the conversation list: avatar, name, last-message preview, and a
 * right-hand column carrying the timestamp above any unread badge.
 */
export default function ChatConversationRow({
  conversation,
  isActive,
  onClick,
}: {
  conversation: MockConversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const { name, preview, timestamp, unreadCount, avatarSeed, outgoing } =
    conversation;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "bg-gray-100 dark:bg-gray-905"
          : "hover:bg-gray-50 dark:hover:bg-gray-905/70"
      }`}
    >
      <ChatAvatar name={avatarSeed} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {name}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {/* Read receipt belongs to the preview, so it only shows when the
              last message was ours. */}
          {outgoing && (
            <LuCheckCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          )}
          <span className="truncate">{preview}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-[11px] ${
            unreadCount ? "text-brand-500" : "text-gray-400"
          }`}
        >
          {timestamp}
        </span>
        {unreadCount ? (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
            {unreadCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}
