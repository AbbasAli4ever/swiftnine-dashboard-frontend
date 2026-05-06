"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useChannelStore } from "@/stores/channel.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import ChannelChatView from "@/components/channels/ChannelChatView";
import type { Channel } from "@/types/channel";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;

  const channels = useChannelStore((s) => s.channels);
  const setActiveChannelId = useChannelStore((s) => s.setActiveChannelId);
  const addChannel = useChannelStore((s) => s.addChannel);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const [channel, setChannel] = useState<Channel | null>(
    channels.find((c) => c.id === channelId) ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const refreshChannel = () => {
    if (!activeWorkspaceId) return;
    channelService.getChannels(activeWorkspaceId).then((all) => {
      const ch = all.find((c) => c.id === channelId);
      if (ch) { addChannel(ch); setChannel(ch); }
    }).catch(() => {});
  };

  useEffect(() => {
    setActiveChannelId(channelId);
    return () => setActiveChannelId(null);
  }, [channelId, setActiveChannelId]);

  useEffect(() => {
    const found = channels.find((c) => c.id === channelId);
    if (found) { setChannel(found); return; }

    if (!activeWorkspaceId) return;
    channelService
      .getChannels(activeWorkspaceId)
      .then((all) => {
        const ch = all.find((c) => c.id === channelId);
        if (ch) {
          addChannel(ch);
          setChannel(ch);
        } else {
          setError("Channel not found or you don't have access.");
        }
      })
      .catch((err) => {
        const { message } = parseApiError(err);
        setError(message || "Failed to load channel");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, activeWorkspaceId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <ChannelChatView
      channelId={channel.id}
      channelName={channel.name}
      members={channel.members}
      privacy={channel.privacy}
      onMembersUpdated={refreshChannel}
    />
  );
}
