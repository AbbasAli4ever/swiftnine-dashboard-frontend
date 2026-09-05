"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ChatFilterPills, { type ChatFilter } from "./ChatFilterPills";
import { toast } from "sonner";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { roomTitle } from "@/lib/chat/format";
import type { ChatChannel } from "@/types/chat";


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
  const [invitingToChannel, setInvitingToChannel] =
    useState<ChatChannel | null>(null);
  const inviteTimer = useRef<number | null>(null);

  // Leaving Chat before the delay elapses would otherwise set state on an
  // unmounted component.
  useEffect(
    () => () => {
      if (inviteTimer.current !== null) window.clearTimeout(inviteTimer.current);
    },
    []
  );

  const selfId = useAuthStore((state) => state.user?.id);
  const channels = useChatStore((state) => state.channels);
  const channelsLoading = useChatStore((state) => state.channelsLoading);

  /* Archived rooms are hidden from every view except the Archived one, which
     is a separate fetch — mirroring the server's own default. */
  const visible = useMemo(
    () => channels.filter((room) => !room.isArchived),
    [channels]
  );
  const channelRooms = useMemo(
    () => visible.filter((room) => room.kind === "CHANNEL"),
    [visible]
  );
  const dmRooms = useMemo(
    () => visible.filter((room) => room.kind === "DM"),
    [visible]
  );
  const archivedCount = useMemo(
    () => channels.filter((room) => room.isArchived).length,
    [channels]
  );

  const counts = useMemo(
    () => ({
      unread: visible.filter((room) => room.unreadCount > 0).length,
      groups: channelRooms.length,
      favourites: visible.filter((room) => room.isFavourite).length,
    }),
    [visible, channelRooms]
  );

  const matches = useCallback(
    (room: ChatChannel) => {
      if (filter === "unread" && room.unreadCount === 0) return false;
      if (filter === "groups" && room.kind !== "CHANNEL") return false;
      if (filter === "favourites" && !room.isFavourite) return false;
      const needle = search.trim().toLowerCase();
      if (needle && !roomTitle(room, selfId).toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    },
    [filter, search, selfId]
  );

  const filteredChannels = useMemo(
    () => channelRooms.filter(matches),
    [channelRooms, matches]
  );
  const conversations = useMemo(
    () => dmRooms.filter(matches),
    [dmRooms, matches]
  );

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
        {channelsLoading && filteredChannels.length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-400">Loading…</p>
        )}
        {filteredChannels.map((channel) => {
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
              {channel.privacy === "PRIVATE" ? (
                <LuLock className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <LuHash className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                {roomTitle(channel, selfId)}
              </span>
              {channel.unreadCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
                  {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
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
          <span className="text-xs text-gray-400">{archivedCount}</span>
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
              selfUserId={selfId}
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>

      <CreateChannelDialog
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onSubmit={async ({ name, isPrivate }) => {
          try {
            const created = await channelService.createChannel(
              name,
              isPrivate ? "PRIVATE" : "PUBLIC"
            );
            useChatStore.getState().upsertChannel(created);
            onSelect(created.id);
            /* Delayed so the create dialog is visibly gone before the invite
               one arrives — chaining them in the same frame reads as the panel
               swapping its contents rather than a new step. */
            inviteTimer.current = window.setTimeout(
              () => setInvitingToChannel(created),
              320
            );
          } catch (err) {
            toast.error(
              parseApiError(err).message || "Couldn't create that channel."
            );
          }
        }}
      />

      {/* Opens after creation succeeds — the channel exists by this point, so
          inviting is a follow-up action rather than part of the flow. */}
      <AddPeopleToChannelDialog
        isOpen={invitingToChannel !== null}
        channelId={invitingToChannel?.id ?? ""}
        channelName={invitingToChannel?.name ?? ""}
        onClose={() => setInvitingToChannel(null)}
      />
    </div>
  );
}
