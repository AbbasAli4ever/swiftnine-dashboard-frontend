"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useChannelStore } from "@/stores/channel.store";
import { useChannelList } from "@/hooks/useChannelList";
import ChannelChatView from "@/components/channels/ChannelChatView";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;

  const setActiveChannelId = useChannelStore((s) => s.setActiveChannelId);
  const addChannel = useChannelStore((s) => s.addChannel);

  const { channels, isLoading, error: listError, refetch } = useChannelList();

  const channel = channels.find((c) => c.id === channelId) ?? null;
  const error = listError
    ? "Failed to load channel"
    : !isLoading && !channel
    ? "Channel not found or you don't have access."
    : null;

  useEffect(() => {
    setActiveChannelId(channelId);
    return () => setActiveChannelId(null);
  }, [channelId, setActiveChannelId]);

  useEffect(() => {
    if (channel) addChannel(channel);
  }, [channel, addChannel]);

  const refreshChannel = () => {
    void refetch();
  };

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
