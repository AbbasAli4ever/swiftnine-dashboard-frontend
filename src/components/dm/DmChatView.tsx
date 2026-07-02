"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/getInitials";
import { useAuth } from "@/context/AuthContext";
import { useUiStore } from "@/stores/ui.store";
import { useDmStore } from "@/stores/dm.store";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { chatService, buildContentJson } from "@/services/chat.service";
import { useChatSocket } from "@/hooks/useChatSocket";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import DmMessageInput from "./DmMessageInput";
import type { ChatMessage } from "@/types/chat";

interface Props {
  userId: string;
  channelId: string;
  otherUserName: string;
  otherUserId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupMessages(messages: ChatMessage[]): { label: string; messages: ChatMessage[] }[] {
  const groups: Map<string, ChatMessage[]> = new Map();
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }
  return Array.from(groups.entries()).map(([label, messages]) => ({ label, messages }));
}

function formatConversationDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderSystemText(contentJson: Record<string, unknown>, resolveName: (id: string) => string): string {
  const event = contentJson.event as string | undefined;
  const actor = resolveName((contentJson.actorUserId ?? contentJson.actorId) as string ?? "");
  const user = resolveName(contentJson.userId as string ?? "");
  switch (event) {
    case "channel_created": return `${actor} created this channel`;
    case "channel_renamed": return `${actor} renamed the channel from "${contentJson.from}" to "${contentJson.to}"`;
    case "channel_privacy_changed": return `${actor} changed the channel to ${(contentJson.to as string)?.toLowerCase() ?? "unknown"}`;
    case "member_joined":
      return contentJson.source === "join_request"
        ? `${user} joined the channel`
        : `${actor} added ${user} to the channel`;
    case "member_role_changed": return `${actor} changed ${user}'s role from ${contentJson.from} to ${contentJson.to}`;
    case "member_removed": return `${actor} removed ${user} from the channel`;
    case "dm_started": return `${actor} started this conversation`;
    default: return event ? `${event.replace(/_/g, " ")}` : "System event";
  }
}

function MessageBubble({
  msg,
  isMe,
  senderName,
  senderInitials,
  senderAvatarUrl,
  senderColor,
  onEdit,
  onDelete,
  resolveName,
}: {
  msg: ChatMessage;
  isMe: boolean;
  senderName: string;
  senderInitials: string;
  senderAvatarUrl: string | null;
  senderColor: string;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  resolveName: (id: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDeleted = !!msg.deletedAt;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);
  const isSystem = msg.kind === "SYSTEM";

  if (isSystem) {
    const systemText = renderSystemText(msg.contentJson, resolveName);
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400 italic px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-full">
          {systemText}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 group relative rounded-lg px-2 py-1 -mx-2 transition-colors ${hovered ? "bg-gray-50 dark:bg-gray-800/50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal shrink-0 mt-0.5 overflow-hidden"
        style={{ backgroundColor: senderColor }}
      >
        {senderAvatarUrl ? (
          <img src={senderAvatarUrl} alt={senderName} className="w-full h-full object-cover" />
        ) : (
          senderInitials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-white">{senderName}</span>
          <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
          {msg.isEdited && !isDeleted && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
        </div>

        {isDeleted ? (
          <p className="text-sm text-gray-400 italic mt-0.5">Message deleted</p>
        ) : (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed whitespace-pre-wrap">
              {msg.plaintext}
            </p>

            {/* Attachments */}
            {msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.attachments.map((att) => {
                  const isImage = att.mimeType.startsWith("image/");
                  if (isImage && att.url) {
                    return (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={att.url}
                          alt={att.fileName}
                          className="max-w-[280px] max-h-[200px] rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                      </a>
                    );
                  }
                  return (
                    <a
                      key={att.id}
                      href={att.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300"
                    >
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
                      </svg>
                      <span className="truncate max-w-[200px]">{att.fileName}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Reactions */}
            {msg.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(
                  msg.reactions.reduce<Record<string, number>>((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]) => (
                  <span
                    key={emoji}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                  >
                    {emoji} <span className="text-gray-400">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Three-dot menu — only for own non-deleted USER messages */}
      {isMe && !isDeleted && hovered && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-50 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 text-sm">
                {Date.now() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000 && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(msg); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Edit
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onDelete(msg); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DmChatView({ userId, channelId, otherUserName, otherUserId }: Props) {
  const { user } = useAuth();
  const { openUserPanel } = useUiStore();
  const { members: workspaceMembers } = useWorkspaceMembers();
  const {
    messagesByChannel,
    messagesLoadingByChannel,
    hasMoreByChannel,
    typingByChannel,
    onlineStatus,
    dmChannels,
    setMessages,
    prependMessages,
    setMessagesLoading,
    clearChannelUnread,
  } = useDmStore();

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const messages = messagesByChannel[channelId] ?? [];
  const isLoading = messagesLoadingByChannel[channelId] ?? false;
  const hasMore = hasMoreByChannel[channelId] ?? false;
  const nextCursor = useDmStore((s) => s.nextCursorByChannel[channelId]);
  const typingUsers = typingByChannel[channelId];
  const otherPresence = onlineStatus[otherUserId];
  const isOtherOnline = otherPresence?.isOnline ?? false;

  const dmChannel = dmChannels.find((c) => c.id === channelId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedMessageIdRef = useRef<string | null>(null);

  const { sendTypingStart, sendTypingStop } = useChatSocket(channelId);

  // Socket reconnect detection
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getChatSocket } = require("@/lib/chat-socket");
    const socket = getChatSocket();

    const onDisconnect = () => setIsReconnecting(true);
    const onReconnect = async () => {
      setIsReconnecting(false);
      try {
        const { items, nextCursor: cursor } = await chatService.getMessages(channelId, null, 50);
        setMessages(channelId, items, cursor);
      } catch {}
    };

    socket.on("disconnect", onDisconnect);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onReconnect);
    };
  }, [channelId, setMessages]);

  // Clear unread badge immediately when the channel is opened
  useEffect(() => {
    if (!channelId) return;
    clearChannelUnread(channelId);
  }, [channelId, clearChannelUnread]);

  // Initial message load — always refetch on mount so messages received
  // while the user was on another screen are guaranteed to appear
  useEffect(() => {
    if (!channelId) return;

    setMessagesLoading(channelId, true);
    setFetchError(null);
    chatService
      .getMessages(channelId)
      .then(({ items, nextCursor: cursor }) => {
        setMessages(channelId, items, cursor);
      })
      .catch((err) => {
        const { message } = parseApiError(err);
        setFetchError(message || "Failed to load messages");
      })
      .finally(() => setMessagesLoading(channelId, false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Auto-scroll to bottom on new messages (only when already at bottom)
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    const newMessage = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (newMessage && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > 0 && prevLengthRef.current === messages.length) {
      // Initial load — scroll to bottom
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages.length]);

  // Track scroll position + debounced mark-read
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 80;

    if (isAtBottomRef.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id !== lastMarkedMessageIdRef.current && !lastMsg.deletedAt) {
        lastMarkedMessageIdRef.current = lastMsg.id;
        if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
          chatService.markRead(channelId, lastMsg.id).catch(() => {});
        }, 1000);
      }
    }
  }, [messages, channelId]);

  // Infinite scroll — load older messages when top sentinel is visible
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !hasMore || isLoadingMore || !nextCursor) return;

        const container = scrollContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;

        setIsLoadingMore(true);
        try {
          const { items, nextCursor: cursor } = await chatService.getMessages(channelId, nextCursor);
          prependMessages(channelId, items, cursor);
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
          });
        } catch (err) {
          const { message } = parseApiError(err);
          toast.error(message || "Failed to load more messages");
        } finally {
          setIsLoadingMore(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [channelId, hasMore, isLoadingMore, nextCursor, prependMessages]);

  const myId = user?.id ?? "";
  const myColor = "#6366f1";
  const myInitials = getInitials(user?.fullName ?? "Me");
  const grouped = groupMessages(messages);
  const workspaceMemberMap = new Map(workspaceMembers.map((m) => [m.id, m.fullName]));
  const resolveName = (id: string) => workspaceMemberMap.get(id) ?? id;
  const typingUserIds = typingUsers ? Array.from(typingUsers).filter((id) => id !== myId) : [];

  const handleEditStart = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditText(msg.plaintext);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const handleEditCancel = () => {
    setEditingMsg(null);
    setEditText("");
  };

  const handleEditSave = async () => {
    if (!editingMsg || !editText.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await chatService.editMessage(editingMsg.id, buildContentJson(editText.trim()));
      setEditingMsg(null);
      setEditText("");
    } catch (err) {
      const { code } = parseApiError(err);
      if (code === "FORBIDDEN") {
        toast.error("Messages can only be edited within 5 minutes of sending.");
      } else {
        toast.error("Failed to edit message. Try again.");
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (msg: ChatMessage) => {
    if (isDeletingId) return;
    setIsDeletingId(msg.id);
    try {
      await chatService.deleteMessage(msg.id);
    } catch {
      toast.error("Failed to delete message. Try again.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const retryLoad = () => {
    setFetchError(null);
    setMessagesLoading(channelId, true);
    chatService
      .getMessages(channelId)
      .then(({ items, nextCursor: cursor }) => setMessages(channelId, items, cursor))
      .catch((err) => {
        const { message } = parseApiError(err);
        setFetchError(message || "Failed to load messages");
      })
      .finally(() => setMessagesLoading(channelId, false));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 shrink-0">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Reconnecting…
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-5 h-14 border-b border-gray-100 dark:border-gray-800 shrink-0 gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal bg-indigo-500">
              {getInitials(otherUserName)}
            </div>
            {isOtherOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
            {otherUserName || "Direct Message"}
          </span>
        </div>
        {/* <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Ask AI
        </button> */}
      </div>

      <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {/* Loading initial */}
            {isLoading && messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {/* Error state */}
            {fetchError && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-sm text-gray-400">{fetchError}</p>
                <button onClick={retryLoad} className="text-sm text-brand-500 hover:underline">
                  Try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !fetchError && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-normal bg-indigo-500">
                  {getInitials(otherUserName)}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                    Chat with {otherUserName}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {dmChannel
                      ? `This conversation started on ${formatConversationDate(dmChannel.createdAt)}.`
                      : "Send a message to start the conversation."}
                  </p>
                </div>
                <button
                  onClick={() => openUserPanel(userId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  View Profile
                </button>
              </div>
            )}

            {/* Messages */}
            {!fetchError && messages.length > 0 && (
              <>
                <div ref={topSentinelRef} className="h-1" />

                {isLoadingMore && (
                  <div className="flex justify-center py-2">
                    <svg className="w-4 h-4 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}

                {!hasMore && dmChannel && (
                  <div className="flex flex-col items-center gap-3 pb-6">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-normal bg-indigo-500">
                      {getInitials(otherUserName)}
                    </div>
                    <div className="text-center">
                      <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                        Chat with {otherUserName}
                      </h2>
                      <p className="text-sm text-gray-400">
                        This conversation started on {formatConversationDate(dmChannel.createdAt)}.
                      </p>
                    </div>
                    <button
                      onClick={() => openUserPanel(userId)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      View Profile
                    </button>
                  </div>
                )}

                {grouped.map(({ label, messages: groupMsgs }) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      <span className="text-xs text-gray-400 bg-white dark:bg-gray-900 px-1">{label}</span>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    </div>

                    <div className="space-y-3">
                      {groupMsgs.map((msg) => {
                        const isMe = msg.senderId === myId;
                        const senderName = isMe
                          ? (user?.fullName ?? "Me")
                          : (msg.sender?.fullName ?? otherUserName);
                        const senderInitials = isMe ? myInitials : getInitials(senderName);
                        const senderColor = isMe ? myColor : "#6366f1";
                        const senderAvatarUrl = isMe
                          ? (user?.avatarUrl ?? null)
                          : (msg.sender?.avatarUrl ?? null);
                        const isEditing = editingMsg?.id === msg.id;

                        if (isEditing) {
                          return (
                            <div key={msg.id} className="flex items-start gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal shrink-0 mt-0.5 overflow-hidden"
                                style={{ backgroundColor: senderColor }}
                              >
                                {senderAvatarUrl ? (
                                  <img src={senderAvatarUrl} alt={senderName} className="w-full h-full object-cover" />
                                ) : senderInitials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-800 dark:text-white">{senderName}</span>
                                  <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                                </div>
                                <textarea
                                  ref={editInputRef}
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                                    if (e.key === "Escape") handleEditCancel();
                                  }}
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-brand-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                                />
                                <div className="flex items-center gap-2 mt-1.5">
                                  <button
                                    onClick={handleEditSave}
                                    disabled={isSavingEdit || !editText.trim()}
                                    className="px-3 py-1 text-xs font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                                  >
                                    {isSavingEdit ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    className="px-3 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <span className="text-xs text-gray-400">Enter to save · Esc to cancel</span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isMe={isMe}
                            senderName={senderName}
                            senderInitials={senderInitials}
                            senderAvatarUrl={senderAvatarUrl}
                            senderColor={senderColor}
                            onEdit={handleEditStart}
                            onDelete={handleDelete}
                            resolveName={resolveName}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {typingUserIds.length > 0 && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 shrink-0" />
                    <div className="flex items-center gap-1.5">
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-gray-400">
                        {otherUserName} is typing…
                      </span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </>
            )}
          </div>

      <DmMessageInput
        recipientName={otherUserName}
        channelId={channelId}
        onTypingStart={sendTypingStart}
        onTypingStop={sendTypingStop}
      />
    </div>
  );
}
