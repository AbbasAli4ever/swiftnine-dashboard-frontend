"use client";

import { useEffect } from "react";
import { getChatSocket } from "@/lib/chat-socket";
import { useChannelStore } from "@/stores/channel.store";
import { useAuthStore } from "@/stores/auth.store";
import type { ChatMessage, ChatReaction, ReadReceiptEvent } from "@/types/chat";

interface TypingEvent {
  channelId: string;
  userId: string;
}

interface DeletedEvent {
  messageId: string;
  deletedAt: string;
}

interface ReactionEvent {
  messageId: string;
  userId: string;
  emoji: string;
}

const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function useGlobalChannelSocket() {
  const {
    upsertMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTyping,
    updateChannelUnread,
    incrementChannelUnread,
  } = useChannelStore();

  useEffect(() => {
    const socket = getChatSocket();

    const onMessageNew = (msg: ChatMessage) => {
      // Only handle CHANNEL messages, not DMs
      const channels = useChannelStore.getState().channels;
      const isChannelMsg = channels.some((c) => c.id === msg.channelId);
      if (!isChannelMsg) return;

      upsertMessage(msg);

      const myId = useAuthStore.getState().user?.id;
      const activeChannelId = useChannelStore.getState().activeChannelId;

      const isFromSelf = msg.senderId === myId;
      const isActiveChannel = msg.channelId === activeChannelId;

      if (!isFromSelf && !isActiveChannel) {
        incrementChannelUnread(msg.channelId);
      }
    };

    const onMessageEdited = (msg: ChatMessage) => {
      const channels = useChannelStore.getState().channels;
      if (!channels.some((c) => c.id === msg.channelId)) return;
      upsertMessage(msg);
    };

    const onMessageDeleted = ({ messageId, deletedAt }: DeletedEvent) =>
      deleteMessage(messageId, deletedAt);

    const onReactionAdded = (r: ReactionEvent & { user?: ChatReaction["user"]; id?: string; createdAt?: string }) => {
      const channels = useChannelStore.getState().channels;
      // We don't have channelId in reaction event — apply optimistically to all
      addReaction(r.messageId, {
        id: r.id ?? `${r.messageId}-${r.userId}-${r.emoji}`,
        messageId: r.messageId,
        userId: r.userId,
        emoji: r.emoji,
        createdAt: r.createdAt ?? new Date().toISOString(),
        user: r.user ?? { id: r.userId, fullName: "", avatarUrl: null },
      });
      void channels; // suppress unused warning
    };

    const onReactionRemoved = ({ messageId, userId, emoji }: ReactionEvent) =>
      removeReaction(messageId, userId, emoji);

    const onMemberRead = ({ channelId: cid, userId, unreadCount, lastReadMessageId }: ReadReceiptEvent) => {
      const myId = useAuthStore.getState().user?.id;
      if (userId !== myId) return;
      updateChannelUnread(cid, unreadCount, lastReadMessageId);
    };

    const onTypingStarted = ({ channelId: cid, userId }: TypingEvent) => {
      const channels = useChannelStore.getState().channels;
      if (!channels.some((c) => c.id === cid)) return;
      setTyping(cid, userId, true);
      const key = `${cid}:${userId}`;
      const existing = typingTimeouts.get(key);
      if (existing) clearTimeout(existing);
      typingTimeouts.set(
        key,
        setTimeout(() => {
          setTyping(cid, userId, false);
          typingTimeouts.delete(key);
        }, 3000)
      );
    };

    const onTypingStopped = ({ channelId: cid, userId }: TypingEvent) => {
      setTyping(cid, userId, false);
      const key = `${cid}:${userId}`;
      const existing = typingTimeouts.get(key);
      if (existing) {
        clearTimeout(existing);
        typingTimeouts.delete(key);
      }
    };

    socket.on("message:new", onMessageNew);
    socket.on("system:event", onMessageNew);
    socket.on("message:edited", onMessageEdited);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("reaction:added", onReactionAdded);
    socket.on("reaction:removed", onReactionRemoved);
    socket.on("member:read", onMemberRead);
    socket.on("typing:user-started", onTypingStarted);
    socket.on("typing:user-stopped", onTypingStopped);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("system:event", onMessageNew);
      socket.off("message:edited", onMessageEdited);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("reaction:added", onReactionAdded);
      socket.off("reaction:removed", onReactionRemoved);
      socket.off("member:read", onMemberRead);
      socket.off("typing:user-started", onTypingStarted);
      socket.off("typing:user-stopped", onTypingStopped);
    };
  }, [upsertMessage, deleteMessage, addReaction, removeReaction, setTyping, updateChannelUnread, incrementChannelUnread]);
}
