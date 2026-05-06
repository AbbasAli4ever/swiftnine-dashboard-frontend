"use client";

import { useEffect, useRef } from "react";
import { getChatSocket } from "@/lib/chat-socket";
import { useDmStore } from "@/stores/dm.store";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
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

export interface ChatSocketControls {
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  isConnected: () => boolean;
}

const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Global hook — mounts once in DmSidebarSection (always rendered).
 * Receives ALL socket events for every DM channel the user is in,
 * even when not on the chat screen.
 */
export function useGlobalChatSocket() {
  const {
    upsertMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTyping,
    updateChannelUnread,
    incrementChannelUnread,
  } = useDmStore();

  useEffect(() => {
    const socket = getChatSocket();

    const onMessageNew = (msg: ChatMessage) => {
      upsertMessage(msg);

      const myId = useAuthStore.getState().user?.id;
      const activeDmUserId = useUiStore.getState().activeDmUserId;
      const activeChannelId = activeDmUserId
        ? useDmStore.getState().userToChannelId[activeDmUserId]
        : null;

      const isFromSelf = msg.senderId === myId;
      const isActiveChannel = msg.channelId === activeChannelId;

      if (!isFromSelf && !isActiveChannel) {
        incrementChannelUnread(msg.channelId);
      }
    };

    const onMessageEdited = (msg: ChatMessage) => upsertMessage(msg);

    const onMessageDeleted = ({ messageId, deletedAt }: DeletedEvent) =>
      deleteMessage(messageId, deletedAt);

    const onReactionAdded = (r: ReactionEvent & { user?: ChatReaction["user"]; id?: string; createdAt?: string }) => {
      addReaction(r.messageId, {
        id: r.id ?? `${r.messageId}-${r.userId}-${r.emoji}`,
        messageId: r.messageId,
        userId: r.userId,
        emoji: r.emoji,
        createdAt: r.createdAt ?? new Date().toISOString(),
        user: r.user ?? { id: r.userId, fullName: "", avatarUrl: null },
      });
    };

    const onReactionRemoved = ({ messageId, userId, emoji }: ReactionEvent) =>
      removeReaction(messageId, userId, emoji);

    const onMemberRead = ({ channelId: cid, userId, unreadCount, lastReadMessageId }: ReadReceiptEvent) => {
      const myId = useAuthStore.getState().user?.id;
      if (userId !== myId) return;
      updateChannelUnread(cid, unreadCount, lastReadMessageId);
    };

    const onTypingStarted = ({ channelId: cid, userId }: TypingEvent) => {
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

/**
 * Per-channel hook — mounts inside DmChatView.
 * Only handles chat:join emit and typing send controls.
 */
export function useChatSocket(channelId: string | null): ChatSocketControls {
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  useEffect(() => {
    if (!channelId) return;
    const socket = getChatSocket();

    const joinChannel = () => socket.emit("chat:join", { channelId });
    if (socket.connected) joinChannel();
    socket.on("connect", joinChannel);

    return () => {
      socket.off("connect", joinChannel);
    };
  }, [channelId]);

  return {
    sendTypingStart: () => {
      if (!channelIdRef.current) return;
      getChatSocket().emit("chat:typing-start", { channelId: channelIdRef.current });
    },
    sendTypingStop: () => {
      if (!channelIdRef.current) return;
      getChatSocket().emit("chat:typing-stop", { channelId: channelIdRef.current });
    },
    isConnected: () => getChatSocket().connected,
  };
}
