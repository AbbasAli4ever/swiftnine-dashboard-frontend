"use client";

import { useEffect } from "react";
import { getInitials } from "@/lib/getInitials";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import { useDmStore } from "@/stores/dm.store";
import { chatService } from "@/services/chat.service";
import { useAuth } from "@/context/AuthContext";
import { usePresenceSocket } from "@/hooks/usePresenceSocket";
import { useGlobalChatSocket } from "@/hooks/useChatSocket";

export default function DmSidebarSection() {
  const { activeDmUserId, openDmThread } = useUiStore();
  const router = useRouter();
  const { user } = useAuth();
  const dmChannels = useDmStore((s) => s.dmChannels);
  const dmChannelsLoading = useDmStore((s) => s.dmChannelsLoading);
  const onlineStatus = useDmStore((s) => s.onlineStatus);
  const setDmChannels = useDmStore((s) => s.setDmChannels);
  const setDmChannelsLoading = useDmStore((s) => s.setDmChannelsLoading);
  const setDmChannelsError = useDmStore((s) => s.setDmChannelsError);
  const setUserToChannelId = useDmStore((s) => s.setUserToChannelId);

  usePresenceSocket();
  useGlobalChatSocket();

  useEffect(() => {
    if (!user) return;
    setDmChannelsLoading(true);
    chatService
      .getDms()
      .then((channels) => {
        setDmChannels(channels);
        for (const ch of channels) {
          const other = ch.members.find((m) => m.userId !== user.id);
          if (other) setUserToChannelId(other.userId, ch.id);
        }
      })
      .catch(() => setDmChannelsError("Failed to load DMs"))
      .finally(() => setDmChannelsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleClickUser = (otherUserId: string) => {
    openDmThread(otherUserId);
    router.push(`/messages/${otherUserId}`);
  };

  const handleNewMessage = () => {
    router.push("/messages");
  };

  if (!user) return null;

  return (
    <div className="mt-4">
      <p className="px-3 pb-1 text-[12px] font-semibold text-[#646464] dark:text-gray-500 uppercase tracking-wider">
        Direct Messages
      </p>

      <div className="space-y-0.5">
        {dmChannelsLoading && dmChannels.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>
        )}

        {dmChannels.map((ch) => {
          const other = ch.members.find((m) => m.userId !== user.id);
          if (!other) return null;

          const isActive = activeDmUserId === other.userId;
          const presence = onlineStatus[other.userId];
          const isOnline = presence?.isOnline ?? false;
          const hasUnread = ch.unreadCount > 0;

          return (
            <button
              key={ch.id}
              onClick={() => handleClickUser(other.userId)}
              className={`flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span
                className="relative flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] shrink-0 overflow-hidden"
                style={{ backgroundColor: "#6366f1" }}
              >
                {other.user.avatarUrl ? (
                  <img
                    src={other.user.avatarUrl}
                    alt={other.user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(other.user.fullName)
                )}
                {isOnline && (
                  <span className="absolute -bottom-0.5 right-0 h-1.5 w-1.5 rounded-full border border-white dark:border-gray-900 bg-green-500" />
                )}
              </span>
              <span className="truncate flex">{other.user.fullName}</span>
              {hasUnread && (
                <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full bg-brand-500 text-white text-[10px] font-medium flex items-center justify-center px-1">
                  {ch.unreadCount > 99 ? "99+" : ch.unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleNewMessage}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 mt-1 rounded-lg text-[14px] text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New message
      </button>
    </div>
  );
}
