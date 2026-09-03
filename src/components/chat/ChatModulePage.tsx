"use client";

import { useState } from "react";
import ChannelThreadPanel from "./ChannelThreadPanel";
import ChatListPanel from "./ChatListPanel";
import ChatThreadPanel from "./ChatThreadPanel";
import {
  MOCK_ACTIVE_CONVERSATION,
  MOCK_CHANNELS,
  MOCK_CONVERSATIONS,
} from "./mockChatData";

/**
 * Chat module — conversation list beside the message thread.
 *
 * The list is rendered here rather than in the sidebar's contextual panel so
 * the whole module is reviewable as one screen in this first UI pass. Moving
 * the list into the rail panel is the follow-up step, once the layout is
 * signed off; `ChatListPanel` already takes `activeId`/`onSelect` so it can be
 * lifted without changing its internals.
 */
export default function ChatModulePage() {
  const [activeId, setActiveId] = useState<string | null>(
    MOCK_ACTIVE_CONVERSATION.id
  );

  /* Ids are unique across both lists, so the selection resolves to whichever
     kind matched — a channel renders the multi-author view, a direct message
     the two-party thread. */
  const activeChannel = MOCK_CHANNELS.find((c) => c.id === activeId) ?? null;
  const activeConversation = activeChannel
    ? null
    : MOCK_CONVERSATIONS.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[10px] bg-white dark:bg-gray-900">
      {/* This list *is* Chat's sidebar — the rail's contextual panel is
          suppressed for this module — so it carries the panel's own styling:
          same muted background and border, at the wider width the rows need. */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-gray-200 bg-[#f9f9f9] dark:border-gray-800 dark:bg-gray-901 md:flex">
        <ChatListPanel activeId={activeId} onSelect={setActiveId} />
      </aside>
      <section className="min-w-0 flex-1">
        {activeChannel ? (
          <ChannelThreadPanel channel={activeChannel} />
        ) : (
          <ChatThreadPanel conversation={activeConversation} />
        )}
      </section>
    </div>
  );
}
