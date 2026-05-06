import { create } from "zustand";
import type { ChatMessage, ChatReaction } from "@/types/chat";
import type { Channel } from "@/types/channel";

interface ChannelState {
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
  activeChannelId: string | null;

  messagesByChannel: Record<string, ChatMessage[]>;
  nextCursorByChannel: Record<string, string | null>;
  messagesLoadingByChannel: Record<string, boolean>;
  hasMoreByChannel: Record<string, boolean>;

  typingByChannel: Record<string, Set<string>>;

  setChannels: (channels: Channel[]) => void;
  setChannelsLoading: (loading: boolean) => void;
  setChannelsError: (error: string | null) => void;
  setActiveChannelId: (id: string | null) => void;
  addChannel: (channel: Channel) => void;

  updateChannelUnread: (channelId: string, unreadCount: number, lastReadMessageId: string) => void;
  clearChannelUnread: (channelId: string) => void;
  incrementChannelUnread: (channelId: string) => void;

  setMessages: (channelId: string, messages: ChatMessage[], nextCursor: string | null) => void;
  prependMessages: (channelId: string, messages: ChatMessage[], nextCursor: string | null) => void;
  upsertMessage: (message: ChatMessage) => void;
  deleteMessage: (messageId: string, deletedAt: string) => void;
  setMessagesLoading: (channelId: string, loading: boolean) => void;

  addReaction: (messageId: string, reaction: ChatReaction) => void;
  removeReaction: (messageId: string, userId: string, emoji: string) => void;

  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  channelsLoading: false,
  channelsError: null,
  activeChannelId: null,
  messagesByChannel: {},
  nextCursorByChannel: {},
  messagesLoadingByChannel: {},
  hasMoreByChannel: {},
  typingByChannel: {},

  setChannels: (channels) => set({ channels }),
  setChannelsLoading: (loading) => set({ channelsLoading: loading }),
  setChannelsError: (error) => set({ channelsError: error }),
  setActiveChannelId: (id) => set({ activeChannelId: id }),
  addChannel: (channel) =>
    set((s) => ({
      channels: s.channels.some((c) => c.id === channel.id)
        ? s.channels
        : [channel, ...s.channels],
    })),

  updateChannelUnread: (channelId, unreadCount, lastReadMessageId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount, lastReadMessageId } : c
      ),
    })),

  clearChannelUnread: (channelId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  incrementChannelUnread: (channelId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    })),

  setMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...messages].reverse(),
      },
      nextCursorByChannel: { ...s.nextCursorByChannel, [channelId]: nextCursor },
      hasMoreByChannel: { ...s.hasMoreByChannel, [channelId]: nextCursor !== null },
    })),

  prependMessages: (channelId, messages, nextCursor) =>
    set((s) => {
      const existing = s.messagesByChannel[channelId] ?? [];
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...[...messages].reverse(), ...existing],
        },
        nextCursorByChannel: { ...s.nextCursorByChannel, [channelId]: nextCursor },
        hasMoreByChannel: { ...s.hasMoreByChannel, [channelId]: nextCursor !== null },
      };
    }),

  upsertMessage: (message) =>
    set((s) => {
      const existing = s.messagesByChannel[message.channelId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      const updated = idx >= 0
        ? existing.map((m, i) => (i === idx ? message : m))
        : [...existing, message];
      return {
        messagesByChannel: { ...s.messagesByChannel, [message.channelId]: updated },
      };
    }),

  deleteMessage: (messageId, deletedAt) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(s.messagesByChannel)) {
        next[cid] = msgs.map((m) =>
          m.id === messageId
            ? { ...m, deletedAt, contentJson: { deleted: true }, plaintext: "" }
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
          return m.reactions.some((r) => r.id === reaction.id)
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
            reactions: m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji)),
          };
        });
      }
      return { messagesByChannel: next };
    }),

  setTyping: (channelId, userId, isTyping) =>
    set((s) => {
      const prev = s.typingByChannel[channelId] ?? new Set<string>();
      const next = new Set(prev);
      if (isTyping) next.add(userId); else next.delete(userId);
      return { typingByChannel: { ...s.typingByChannel, [channelId]: next } };
    }),
}));
