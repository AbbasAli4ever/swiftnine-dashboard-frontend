"use client";

import {
  LuChevronDown,
  LuListPlus,
  LuPhone,
  LuSearch,
  LuVideo,
} from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import ChatComposer from "./ChatComposer";
import ChatMessageBubble from "./ChatMessageBubble";
import { MOCK_MESSAGES, type MockConversation } from "./mockChatData";

/**
 * The message thread: header, scrolling message list, and composer.
 *
 * The header's call/video/search actions are presentational for this pass —
 * there is no calling backend, so they are rendered but inert.
 */
export default function ChatThreadPanel({
  conversation,
}: {
  conversation: MockConversation | null;
}) {
  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          No conversation selected
        </p>
        <p className="max-w-xs text-xs text-gray-400">
          Pick a chat from the list to see its messages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800">
        <ChatAvatar name={conversation.avatarSeed} size={36} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {conversation.name}
        </p>
        <button
          type="button"
          className="hidden h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 sm:flex dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <LuListPlus className="h-3.5 w-3.5" />
          Add to list
          <LuChevronDown className="h-3 w-3" />
        </button>
        {[
          { icon: LuVideo, label: "Start a video call" },
          { icon: LuPhone, label: "Start a voice call" },
          { icon: LuSearch, label: "Search in conversation" },
          { icon: LuChevronDown, label: "More options" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {MOCK_MESSAGES.map((message) => (
          <div key={message.id} className="space-y-3">
            {message.daySeparator && (
              <p className="py-1 text-center text-[11px] font-medium text-gray-400">
                {message.daySeparator}
              </p>
            )}
            <ChatMessageBubble message={message} />
          </div>
        ))}
      </div>

      <ChatComposer />
    </div>
  );
}
