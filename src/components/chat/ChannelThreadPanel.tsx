"use client";

import { useState } from "react";
import { LuBell, LuBellOff, LuChevronDown, LuCircleX, LuHash, LuLock, LuUser } from "react-icons/lu";
import ChannelOnboardingCards from "./ChannelOnboardingCards";
import ChatComposer from "./ChatComposer";
import {
  MOCK_CHANNEL_EVENTS,
  MOCK_CHANNEL_MESSAGES,
  type MockChannel,
} from "./mockChatData";

/**
 * A channel's message area.
 *
 * Differs from the DM thread in two ways: messages carry an author, since any
 * member can post, and a freshly created channel opens on its setup state —
 * the origin line, the three onboarding cards, and the welcome banner — rather
 * than on empty history.
 */
export default function ChannelThreadPanel({ channel }: { channel: MockChannel }) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-6 dark:border-gray-800">
        {channel.isPrivate ? (
          <LuLock className="h-4 w-4 shrink-0 text-gray-700 dark:text-gray-200" />
        ) : (
          <LuHash className="h-4 w-4 shrink-0 text-gray-700 dark:text-gray-200" />
        )}
        <p className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
          {channel.name}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Origin line — only meaningful while the channel is still new. */}
        {channel.isNew && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You created this channel today. This is the very beginning of the{" "}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                {channel.name}
              </strong>{" "}
              channel.
            </p>

            <div className="mt-5">
              <ChannelOnboardingCards isPrivate={channel.isPrivate} />
            </div>

            {/* Day divider */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Today
                <LuChevronDown className="h-3 w-3" />
              </button>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
          </>
        )}

        {/* System events — joins, renames. No bubble: these aren't messages. */}
        {MOCK_CHANNEL_EVENTS.map((event) => (
          <div key={event.id} className="flex items-start gap-3 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
              <LuUser className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {event.actor}
                </span>
                <span className="text-xs text-gray-400">{event.time}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {event.text}
              </p>
            </div>
          </div>
        ))}

        {/* Real messages. Empty for a new channel — the events above and the
            banner below are all there is until someone posts. */}
        {MOCK_CHANNEL_MESSAGES.map((message) => (
          <div key={message.id} className="flex items-start gap-3 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
              <LuUser className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {message.author}
                </span>
                <span className="text-xs text-gray-400">{message.time}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">
                {message.body}
              </p>
            </div>
          </div>
        ))}

        {/* Welcome banner */}
        {channel.isNew && !welcomeDismissed && (
          <div className="relative mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-905">
            <button
              type="button"
              aria-label="Dismiss welcome message"
              onClick={() => setWelcomeDismissed(true)}
              className="absolute right-3 top-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            >
              <LuCircleX className="h-4 w-4" />
            </button>

            <p className="pr-8 text-sm font-semibold text-gray-900 dark:text-gray-100">
              👋 Welcome to #{channel.name.toLowerCase()}
            </p>
            <p className="mt-1 pr-8 text-sm text-gray-600 dark:text-gray-300">
              Group this channel with similar conversations in your sidebar and
              choose when you want to be notified about new messages.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Mute this channel"
                className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LuBellOff className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuBell className="h-3.5 w-3.5" />
                All new posts
                <LuChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ChatComposer />
    </div>
  );
}
