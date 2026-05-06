import { create } from "zustand";
import type { ChatMessage, ChatReaction, DmChannel } from "@/types/chat";

interface OnlineStatus {
  isOnline: boolean;
  lastSeenAt: string | null;
}

interface DmState {
  // DM channel list (sidebar)
  dmChannels: DmChannel[];
  dmChannelsLoading: boolean;
  dmChannelsError: string | null;

  // Messages keyed by channelId (oldest → newest in array)
  messagesByChannel: Record<string, ChatMessage[]>;
  nextCursorByChannel: Record<string, string | null>;
  messagesLoadingByChannel: Record<string, boolean>;
  hasMoreByChannel: Record<string, boolean>;

  // Typing indicators: channelId → Set of userIds currently typing
  typingByChannel: Record<string, Set<string>>;

  // Online presence: userId → status
  onlineStatus: Record<string, OnlineStatus>;

  // userId → channelId resolved DM mapping
  userToChannelId: Record<string, string>;

  // Actions — channels
  setDmChannels: (channels: DmChannel[]) => void;
  setDmChannelsLoading: (loading: boolean) => void;
  setDmChannelsError: (error: string | null) => void;
  updateChannelUnread: (channelId: string, unreadCount: number, lastReadMessageId: string) => void;
  clearChannelUnread: (channelId: string) => void;
  incrementChannelUnread: (channelId: string) => void;

  // Actions — messages
  setMessages: (channelId: string, messages: ChatMessage[], nextCursor: string | null) => void;
  prependMessages: (channelId: string, messages: ChatMessage[], nextCursor: string | null) => void;
  upsertMessage: (message: ChatMessage) => void;
  deleteMessage: (messageId: string, deletedAt: string) => void;
  setMessagesLoading: (channelId: string, loading: boolean) => void;

  // Actions — reactions
  addReaction: (messageId: string, reaction: ChatReaction) => void;
  removeReaction: (messageId: string, userId: string, emoji: string) => void;

  // Actions — typing
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;

  // Actions — presence
  setOnline: (userId: string, isOnline: boolean, lastSeenAt: string | null) => void;

  // Actions — routing helper
  setUserToChannelId: (userId: string, channelId: string) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  dmChannels: [],
  dmChannelsLoading: false,
  dmChannelsError: null,
  messagesByChannel: {},
  nextCursorByChannel: {},
  messagesLoadingByChannel: {},
  hasMoreByChannel: {},
  typingByChannel: {},
  onlineStatus: {},
  userToChannelId: {},

  setDmChannels: (channels) => set({ dmChannels: channels }),
  setDmChannelsLoading: (loading) => set({ dmChannelsLoading: loading }),
  setDmChannelsError: (error) => set({ dmChannelsError: error }),

  updateChannelUnread: (channelId, unreadCount, lastReadMessageId) =>
    set((s) => ({
      dmChannels: s.dmChannels.map((c) =>
        c.id === channelId ? { ...c, unreadCount, lastReadMessageId } : c
      ),
    })),

  clearChannelUnread: (channelId) =>
    set((s) => ({
      dmChannels: s.dmChannels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  incrementChannelUnread: (channelId) =>
    set((s) => ({
      dmChannels: s.dmChannels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    })),

  setMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        // messages come from API newest-first; reverse to oldest-first for display
        [channelId]: [...messages].reverse(),
      },
      nextCursorByChannel: { ...s.nextCursorByChannel, [channelId]: nextCursor },
      hasMoreByChannel: { ...s.hasMoreByChannel, [channelId]: nextCursor !== null },
    })),

  prependMessages: (channelId, messages, nextCursor) =>
    set((s) => {
      const existing = s.messagesByChannel[channelId] ?? [];
      // messages come from API newest-first; reverse and prepend before existing
      const older = [...messages].reverse();
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...older, ...existing],
        },
        nextCursorByChannel: { ...s.nextCursorByChannel, [channelId]: nextCursor },
        hasMoreByChannel: { ...s.hasMoreByChannel, [channelId]: nextCursor !== null },
      };
    }),

  upsertMessage: (message) =>
    set((s) => {
      const existing = s.messagesByChannel[message.channelId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      let updated: ChatMessage[];
      if (idx >= 0) {
        updated = [...existing];
        updated[idx] = message;
      } else {
        updated = [...existing, message];
      }
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [message.channelId]: updated,
        },
      };
    }),

  deleteMessage: (messageId, deletedAt) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(s.messagesByChannel)) {
        next[cid] = msgs.map((m) =>
          m.id === messageId
            ? {
                ...m,
                deletedAt,
                contentJson: { deleted: true },
                plaintext: "",
              }
            : m
        );
      }
      return { messagesByChannel: next };
    }),

  setMessagesLoading: (channelId, loading) =>
    set((s) => ({
      messagesLoadingByChannel: { ...s.messagesLoadingByChannel, [channelId]: loading },
    })),

  addReaction: (messageId, reaction) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(s.messagesByChannel)) {
        next[cid] = msgs.map((m) => {
          if (m.id !== messageId) return m;
          const alreadyExists = m.reactions.some((r) => r.id === reaction.id);
          return alreadyExists
            ? m
            : { ...m, reactions: [...m.reactions, reaction] };
        });
      }
      return { messagesByChannel: next };
    }),

  removeReaction: (messageId, userId, emoji) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(s.messagesByChannel)) {
        next[cid] = msgs.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: m.reactions.filter(
              (r) => !(r.userId === userId && r.emoji === emoji)
            ),
          };
        });
      }
      return { messagesByChannel: next };
    }),

  setTyping: (channelId, userId, isTyping) =>
    set((s) => {
      const prev = s.typingByChannel[channelId] ?? new Set<string>();
      const next = new Set(prev);
      if (isTyping) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return {
        typingByChannel: { ...s.typingByChannel, [channelId]: next },
      };
    }),

  setOnline: (userId, isOnline, lastSeenAt) =>
    set((s) => ({
      onlineStatus: {
        ...s.onlineStatus,
        [userId]: { isOnline, lastSeenAt },
      },
    })),

  setUserToChannelId: (userId, channelId) =>
    set((s) => ({
      userToChannelId: { ...s.userToChannelId, [userId]: channelId },
    })),
}));
