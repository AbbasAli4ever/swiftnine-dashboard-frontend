"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useChannelStore } from "@/stores/channel.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { channelService } from "@/services/channel.service";
import { useGlobalChannelSocket } from "@/hooks/useGlobalChannelSocket";

export default function ChannelSidebarSection() {
  const router = useRouter();
  const pathname = usePathname();

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channels = useChannelStore((s) => s.channels);
  const channelsLoading = useChannelStore((s) => s.channelsLoading);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setChannels = useChannelStore((s) => s.setChannels);
  const setChannelsLoading = useChannelStore((s) => s.setChannelsLoading);
  const setChannelsError = useChannelStore((s) => s.setChannelsError);
  const setActiveChannelId = useChannelStore((s) => s.setActiveChannelId);

  useGlobalChannelSocket();

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setChannelsLoading(true);
    channelService
      .getChannels(activeWorkspaceId)
      .then((ch) => setChannels(ch.filter((c) => c.kind === "CHANNEL" && c.isMember)))
      .catch(() => setChannelsError("Failed to load channels"))
      .finally(() => setChannelsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // Sync active channel from URL
  useEffect(() => {
    const match = pathname.match(/^\/channels\/([^/]+)/);
    if (match) {
      setActiveChannelId(match[1]);
    } else {
      setActiveChannelId(null);
    }
  }, [pathname, setActiveChannelId]);

  const handleClickChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    router.push(`/channels/${channelId}`);
  };

  const handleAddChannel = () => {
    router.push("/channels");
  };

  return (
    <div className="mt-4">
      <p className="px-3 pb-1 text-[12px] font-semibold text-[#646464] dark:text-gray-500 uppercase tracking-wider">
        Channels
      </p>

      <div className="space-y-0.5">
        {channelsLoading && channels.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>
        )}

        {channels.map((ch) => {
          const isActive = activeChannelId === ch.id;
          const hasUnread = ch.unreadCount > 0;

          return (
            <button
              key={ch.id}
              onClick={() => handleClickChannel(ch.id)}
              className={`flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span className="text-gray-400 dark:text-gray-500 font-medium text-sm shrink-0">#</span>
              <span className="truncate flex-1 text-left">{ch.name}</span>
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
        onClick={handleAddChannel}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 mt-1 rounded-lg text-[14px] text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Channel
      </button>
    </div>
  );
}
