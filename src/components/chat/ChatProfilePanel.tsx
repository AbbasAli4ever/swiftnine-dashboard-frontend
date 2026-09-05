"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LuArchive,
  LuBellOff,
  LuChevronRight,
  LuClock,
  LuFile,
  LuFlag,
  LuMail,
  LuMailOpen,
  LuPhoneCall,
  LuStar,
  LuUser,
  LuX,
} from "react-icons/lu";
import { userService } from "@/services/user.service";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { roomTitle } from "@/lib/chat/format";
import ChatAvatar from "./ChatAvatar";
import type { UserProfile } from "@/hooks/useProfile";
import type { ChannelAttachments, ChatChannel } from "@/types/chat";

/**
 * Right-hand detail panel for the open conversation.
 *
 * Chat-specific rather than a reuse of `ViewUserProfilePanel`: it carries room
 * actions (favourite, mute, close) that a generic profile view has no business
 * knowing about.
 *
 * Several rows are intentionally inert — Priorities, SyncUp, Media/Links and
 * "Mark as unread" have no endpoint behind them (the API can mark read, never
 * unread). They are rendered because the design calls for them; they do
 * nothing until the backend catches up.
 */
export default function ChatProfilePanel({
  room,
  isOpen,
  onClose,
}: {
  room: ChatChannel | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const selfId = useAuthStore((s) => s.user?.id);
  const onlineStatus = useChatStore((s) => s.onlineStatus);
  const patchChannel = useChatStore((s) => s.patchChannel);
  const removeChannel = useChatStore((s) => s.removeChannel);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [media, setMedia] = useState<ChannelAttachments | null>(null);

  const other = room?.members.find((m) => m.userId !== selfId) ?? null;
  const isDm = room?.kind === "DM";

  /* Keyed on the person, so switching rooms refetches rather than showing the
     previous profile. Clearing on close is handled by the render guard below,
     not by writing state from this effect. */
  const otherUserId = isOpen && isDm ? other?.userId : undefined;

  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    userService
      .getById(otherUserId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  /* Only fetched when the panel is actually open: the endpoint scans the whole
     message history and signs fresh S3 URLs, so firing it alongside every
     conversation load would be a wasted round trip. The URLs expire in 15
     minutes, which is why this refetches on each open rather than caching. */
  const mediaChannelId = isOpen ? room?.id : undefined;

  useEffect(() => {
    if (!mediaChannelId) return;
    let cancelled = false;
    chatService
      .getChannelAttachments(mediaChannelId)
      .then((result) => {
        if (!cancelled) setMedia(result);
      })
      .catch(() => {
        if (!cancelled) setMedia(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaChannelId]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !room) return null;

  /* Only trust the fetched profile if it is this conversation's person — a
     stale one can linger for a frame after switching rooms. */
  const shownProfile = profile && profile.id === otherUserId ? profile : null;
  /* Images first — they are the only ones with a useful thumbnail; everything
     else falls back to a file glyph. Capped at 8 to keep the panel compact. */
  const allMedia = media
    ? [...media.images, ...media.videos, ...media.files]
    : [];
  const totalMedia = allMedia.length;
  const previews = allMedia.slice(0, 8);

  const title = roomTitle(room, selfId);
  const presence = other ? onlineStatus[other.userId] : undefined;

  const toggleFavourite = async () => {
    const next = !room.isFavourite;
    patchChannel(room.id, { isFavourite: next });
    try {
      await chatService.setFavourite(room.id, next);
    } catch (err) {
      patchChannel(room.id, { isFavourite: !next });
      toast.error(parseApiError(err).message || "Couldn't update favourite.");
    }
  };

  const toggleMute = async () => {
    const next = !room.isMuted;
    patchChannel(room.id, { isMuted: next });
    try {
      await chatService.setMuted(room.id, next);
    } catch (err) {
      patchChannel(room.id, { isMuted: !next });
      toast.error(parseApiError(err).message || "Couldn't update mute.");
    }
  };

  /* "Close DM" is archive — per-person, so the other participant's list is
     untouched and the room returns the moment a new message arrives. */
  const closeConversation = async () => {
    try {
      await chatService.setArchived(room.id, true);
      removeChannel(room.id);
      onClose();
      toast.success("Conversation closed.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't close conversation.");
    }
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex shrink-0 justify-end p-3">
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {/* Identity */}
        <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
          <div className="flex justify-center">
            <ChatAvatar name={title} size={72} />
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: LuUser, label: "Profile", inert: false },
              { icon: LuFlag, label: "Priorities", inert: true },
              { icon: LuPhoneCall, label: "SyncUp", inert: true },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg py-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Details — DMs only; a channel has no single person behind it. */}
        {isDm && (
          <div className="space-y-2.5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
              <LuClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {presence?.isOnline
                ? "Online now"
                : presence?.lastSeenAt
                  ? `Last online ${new Date(presence.lastSeenAt).toLocaleDateString()}`
                  : "Offline"}
            </p>
            {shownProfile?.email && (
              <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                <LuMail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{shownProfile.email}</span>
              </p>
            )}
            {shownProfile?.localTime && (
              <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                <LuClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {shownProfile.localTime}
              </p>
            )}
          </div>
        )}

        {/* No endpoint lists a room's attachments yet — placeholder only. */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            Media, Links and docs
          </p>
          {previews.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">
              Nothing shared here yet.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {previews.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title={item.fileName}
                    className="aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800"
                  >
                    {item.mimeType.startsWith("image/") && item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={item.fileName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-gray-400">
                        <LuFile className="h-4 w-4" />
                      </span>
                    )}
                  </a>
                ))}
              </div>
              {totalMedia > previews.length && (
                <p className="mt-2 text-[11px] text-gray-400">
                  +{totalMedia - previews.length} more
                </p>
              )}
            </>
          )}
        </div>

        {/* Options */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
            Options
          </p>

          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LuMailOpen className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1">Mark as unread</span>
            <span className="text-[11px] text-gray-400">U</span>
          </button>

          <button
            type="button"
            onClick={toggleFavourite}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LuStar
              className={`h-4 w-4 shrink-0 ${
                room.isFavourite
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-400"
              }`}
            />
            <span className="flex-1">
              {room.isFavourite ? "Remove from favourites" : "Favorite"}
            </span>
            <LuChevronRight className="h-3.5 w-3.5 text-gray-400" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LuBellOff className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1">
              {room.isMuted ? "Unmute conversation" : "Mute conversation"}
            </span>
          </button>

          <button
            type="button"
            onClick={closeConversation}
            className="flex w-full items-start gap-2.5 rounded-b-xl px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <LuArchive className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>
              <span className="block text-sm text-gray-700 dark:text-gray-200">
                {isDm ? "Close DM" : "Close channel"}
              </span>
              <span className="block text-[11px] text-gray-400">
                Will reappear with new messages
              </span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
