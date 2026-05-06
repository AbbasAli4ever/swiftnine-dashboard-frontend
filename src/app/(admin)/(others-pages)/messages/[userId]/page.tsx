"use client";

import { use, useEffect, useState } from "react";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import { useDmStore } from "@/stores/dm.store";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import DmChatView from "@/components/dm/DmChatView";
import { useWorkspaceStore } from "@/stores/workspace.store";

interface Props {
  params: Promise<{ userId: string }>;
}

export default function MessageThreadPage({ params }: Props) {
  const { userId } = use(params);
  const { openDmThread } = useUiStore();
  const router = useRouter();
  const { userToChannelId, setUserToChannelId, setDmChannels, dmChannels } = useDmStore();
  const members = useWorkspaceStore((s) => s.members);

  const [channelId, setChannelId] = useState<string | null>(
    userToChannelId[userId] ?? null
  );
  const [resolving, setResolving] = useState(!userToChannelId[userId]);
  const [error, setError] = useState<string | null>(null);

  // Resolve userId → channelId
  useEffect(() => {
    const cached = userToChannelId[userId];
    if (cached) {
      setChannelId(cached);
      setResolving(false);
      openDmThread(userId);
      return;
    }

    setResolving(true);
    setError(null);
    chatService
      .createOrGetDm(userId)
      .then((ch) => {
        setUserToChannelId(userId, ch.id);
        const exists = dmChannels.some((c) => c.id === ch.id);
        if (!exists) setDmChannels([...dmChannels, ch]);
        setChannelId(ch.id);
        openDmThread(userId);
      })
      .catch((err) => {
        const { message } = parseApiError(err);
        setError(message || "Failed to open conversation");
        toast.error(message || "Failed to open conversation");
      })
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (resolving) {
    return (
      <div className="flex items-center justify-center h-full">
        <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !channelId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-400">{error ?? "Conversation not found."}</p>
          <button
            onClick={() => router.push("/messages")}
            className="mt-3 text-sm text-brand-500 hover:underline"
          >
            Start a new message
          </button>
        </div>
      </div>
    );
  }

  // Find member info for the other user (from workspace members or DM channel)
  const otherMember = members.find((m) => m.id === userId);

  return (
    <DmChatView
      userId={userId}
      channelId={channelId}
      otherUserName={otherMember?.fullName ?? ""}
      otherUserId={userId}
    />
  );
}
