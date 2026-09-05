"use client";

import { useEffect, useState } from "react";
import ChannelThreadPanel from "./ChannelThreadPanel";
import ChatProfilePanel from "./ChatProfilePanel";
import ChatListPanel from "./ChatListPanel";
import ChatThreadPanel from "./ChatThreadPanel";
import { useChatStore } from "@/stores/chat.store";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const channels = useChatStore((state) => state.channels);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);

  /* Tells the realtime hook which room is on screen, so its incoming messages
     don't raise an unread badge. */
  useEffect(() => {
    setActiveChannel(activeId);
    return () => setActiveChannel(null);
  }, [activeId, setActiveChannel]);

  /* DMs and channels are one entity discriminated by `kind`, so the selected
     id resolves to whichever thread view suits it. */
  const active = channels.find((room) => room.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[10px] bg-white dark:bg-gray-900">
      {/* This list *is* Chat's sidebar — the rail's contextual panel is
          suppressed for this module — so it carries the panel's own styling:
          same muted background and border, at the wider width the rows need. */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-gray-200 bg-[#f9f9f9] dark:border-gray-800 dark:bg-gray-901 md:flex">
        <ChatListPanel activeId={activeId} onSelect={setActiveId} />
      </aside>
      <section className="min-w-0 flex-1">
        {active?.kind === "CHANNEL" ? (
          <ChannelThreadPanel channel={active} />
        ) : (
          <ChatThreadPanel
            conversation={active}
            onOpenProfile={() => setProfileOpen(true)}
          />
        )}
      </section>

      <ChatProfilePanel
        room={active}
        isOpen={profileOpen && active !== null}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}
