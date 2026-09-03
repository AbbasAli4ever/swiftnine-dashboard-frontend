"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuArchive,
  LuBell,
  LuEllipsisVertical,
  LuHash,
  LuLock,
  LuPlus,
  LuSearch,
  LuSquarePen,
  LuX,
} from "react-icons/lu";
import ChatConversationRow from "./ChatConversationRow";
import AddPeopleToChannelDialog from "./AddPeopleToChannelDialog";
import CreateChannelDialog from "./CreateChannelDialog";
import ChatFilterPills from "./ChatFilterPills";
import {
  MOCK_CHANNELS,
  MOCK_CONVERSATIONS,
  type ChatFilter,
} from "./mockChatData";

/**
 * The Chat module's list pane — search, quick filters, channels, and direct
 * messages. Renders inside the sidebar's contextual panel, so it owns no
 * chrome of its own beyond its header.
 *
 * UI-only for now: conversations come from `mockChatData`, and selection is
 * local state rather than a route.
 */
export default function ChatListPanel({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  /** Fires for channels and direct messages alike — ids are unique across
   *  both, so the page resolves which kind it is. */
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  /* Set once a channel is created, which opens the invite dialog for it. Null
     means no invite prompt is pending. */
  const [invitingToChannel, setInvitingToChannel] = useState<string | null>(null);
  const inviteTimer = useRef<number | null>(null);

  // Leaving Chat before the delay elapses would otherwise set state on an
  // unmounted component.
  useEffect(
    () => () => {
      if (inviteTimer.current !== null) window.clearTimeout(inviteTimer.current);
    },
    []
  );

  const counts = useMemo(
    () => ({
      unread: MOCK_CONVERSATIONS.filter((c) => c.unreadCount).length,
      groups: MOCK_CONVERSATIONS.filter((c) => c.isGroup).length,
      favourites: MOCK_CONVERSATIONS.filter((c) => c.isFavourite).length,
    }),
    []
  );

  const conversations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return MOCK_CONVERSATIONS.filter((c) => {
      if (filter === "unread" && !c.unreadCount) return false;
      if (filter === "groups" && !c.isGroup) return false;
      if (filter === "favourites" && !c.isFavourite) return false;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [filter, search]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
          Swiftnine Chat
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="New chat"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LuSquarePen className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Chat options"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LuEllipsisVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search chats"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      <ChatFilterPills active={filter} counts={counts} onChange={setFilter} />

      {/* Everything below the filters scrolls together, so the search and
          pills stay put while a long conversation list moves. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!bannerDismissed && (
          <div className="mx-3 mb-2 flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-905">
            <LuBell className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p className="min-w-0 flex-1 text-xs text-gray-600 dark:text-gray-300">
              Message notifications are off.{" "}
              <button
                type="button"
                className="font-medium text-brand-500 hover:text-brand-600"
              >
                Turn on
              </button>
            </p>
            <button
              type="button"
              aria-label="Dismiss notification banner"
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Channels */}
        <p className="px-4 pb-1 pt-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
          Channels
        </p>
        {MOCK_CHANNELS.map((channel) => {
          const isActive = channel.id === activeId;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-905"
                  : "hover:bg-gray-50 dark:hover:bg-gray-905/70"
              }`}
            >
              {channel.isPrivate ? (
                <LuLock className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <LuHash className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                {channel.name}
              </span>
              {channel.context && (
                <span className="truncate text-xs text-gray-400">
                  - {channel.context}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreateChannelOpen(true)}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-905/70"
        >
          <LuPlus className="h-4 w-4 shrink-0" />
          Add Channel
        </button>

        {/* Archived */}
        <button
          type="button"
          className="mt-2 flex w-full items-center gap-2 border-y border-gray-100 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-905/70"
        >
          <LuArchive className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Archived
          </span>
          <span className="text-xs text-gray-400">1</span>
        </button>

        {/* Direct messages */}
        <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
          Direct Messages
        </p>
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400">
            {search.trim() ? "No chats match that search." : "No chats yet."}
          </p>
        ) : (
          conversations.map((conversation) => (
            <ChatConversationRow
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>

      <CreateChannelDialog
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onSubmit={({ name }) => {
          /* Delayed so the create dialog is visibly gone before this one
             arrives — chaining them in the same frame reads as the panel
             abruptly changing its contents rather than a new step. */
          inviteTimer.current = window.setTimeout(
            () => setInvitingToChannel(name),
            320
          );
        }}
      />

      {/* Opens after creation succeeds — the channel exists by this point, so
          inviting is a follow-up action rather than part of the flow. */}
      <AddPeopleToChannelDialog
        isOpen={invitingToChannel !== null}
        channelName={invitingToChannel ?? ""}
        onClose={() => setInvitingToChannel(null)}
      />
    </div>
  );
}
