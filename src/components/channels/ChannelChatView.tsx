"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/getInitials";
import { useAuth } from "@/context/AuthContext";
import { useChannelStore } from "@/stores/channel.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { chatService, buildContentJson } from "@/services/chat.service";
import { channelService } from "@/services/channel.service";
import { useChatSocket } from "@/hooks/useChatSocket";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import DmMessageInput from "@/components/dm/DmMessageInput";
import type { ChatMessage } from "@/types/chat";
import type { ChannelMember } from "@/types/channel";

interface Props {
  channelId: string;
  channelName: string;
  members: ChannelMember[];
  privacy: "PUBLIC" | "PRIVATE";
  onMembersUpdated?: () => void;
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
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

function MessageBubble({
  msg,
  isMe,
  senderName,
  senderInitials,
  senderAvatarUrl,
  senderColor,
  onEdit,
  onDelete,
}: {
  msg: ChatMessage;
  isMe: boolean;
  senderName: string;
  senderInitials: string;
  senderAvatarUrl: string | null;
  senderColor: string;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDeleted = !!msg.deletedAt;
  const isSystem = msg.kind === "SYSTEM";

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

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400 italic px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-full">
          {msg.plaintext || "System event"}
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
        ) : senderInitials}
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

            {msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.attachments.map((att) => {
                  const isImage = att.mimeType.startsWith("image/");
                  if (isImage && att.url) {
                    return (
                      <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={att.url} alt={att.fileName} className="max-w-[280px] max-h-[200px] rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                      </a>
                    );
                  }
                  return (
                    <a key={att.id} href={att.url ?? "#"} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
                      </svg>
                      <span className="truncate max-w-[200px]">{att.fileName}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {msg.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(
                  msg.reactions.reduce<Record<string, number>>((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]) => (
                  <span key={emoji} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {emoji} <span className="text-gray-400">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

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

export default function ChannelChatView({ channelId, channelName, members, privacy, onMembersUpdated }: Props) {
  const { user } = useAuth();
  const {
    messagesByChannel,
    messagesLoadingByChannel,
    hasMoreByChannel,
    typingByChannel,
    setMessages,
    prependMessages,
    setMessagesLoading,
    clearChannelUnread,
  } = useChannelStore();

  const workspaceMembers = useWorkspaceStore((s) => s.members);
  const fetchWorkspaceMembers = useWorkspaceStore((s) => s.fetchMembers);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Members sidebar
  const [showMembersSidebar, setShowMembersSidebar] = useState(false);
  const [membersTab, setMembersTab] = useState<"followers" | "access">("followers");
  const [memberSearch, setMemberSearch] = useState("");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (showMembersSidebar) fetchWorkspaceMembers();
  }, [showMembersSidebar, fetchWorkspaceMembers]);

  const memberCount = members.length;
  const memberUserIds = new Set(members.map((m) => m.userId));

  const messages = messagesByChannel[channelId] ?? [];
  const isLoading = messagesLoadingByChannel[channelId] ?? false;
  const hasMore = hasMoreByChannel[channelId] ?? false;
  const nextCursor = useChannelStore((s) => s.nextCursorByChannel[channelId]);
  const typingUsers = typingByChannel[channelId];

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

  // Clear unread
  useEffect(() => {
    if (!channelId) return;
    clearChannelUnread(channelId);
  }, [channelId, clearChannelUnread]);

  // Initial load
  useEffect(() => {
    if (!channelId) return;
    setMessagesLoading(channelId, true);
    setFetchError(null);
    chatService
      .getMessages(channelId)
      .then(({ items, nextCursor: cursor }) => setMessages(channelId, items, cursor))
      .catch((err) => {
        const { message } = parseApiError(err);
        setFetchError(message || "Failed to load messages");
      })
      .finally(() => setMessagesLoading(channelId, false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Auto-scroll
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    const newMessage = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (newMessage && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > 0 && !newMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages.length]);

  // Scroll tracking + mark read
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

  // Infinite scroll
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
            if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
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

  const handleEditStart = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditText(msg.plaintext);
    setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 0);
  };

  const handleEditCancel = () => { setEditingMsg(null); setEditText(""); };

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

  const myId = user?.id ?? "";
  const myColor = "#6366f1";
  const myInitials = getInitials(user?.fullName ?? "Me");
  const grouped = groupMessages(messages);
  const typingUserIds = typingUsers ? Array.from(typingUsers).filter((id) => id !== myId) : [];

  const handleAddMember = async (userId: string) => {
    setAddingUserId(userId);
    try {
      await channelService.addMember(channelId, userId);
      toast.success("Member added");
      onMembersUpdated?.();
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "Failed to add member");
    } finally {
      setAddingUserId(null);
    }
  };

  // Filtered lists for sidebar
  const filteredFollowers = members.filter((m) =>
    m.user.fullName.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const filteredAccess = workspaceMembers.filter((m) =>
    m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-gray-400 font-medium text-lg shrink-0">#</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{channelName}</span>
            {privacy === "PRIVATE" && (
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Ask AI
            </button>
            {/* Member count avatar button */}
            <button
              onClick={() => setShowMembersSidebar((v) => !v)}
              className={`relative flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-medium transition-colors ${showMembersSidebar ? "bg-indigo-600" : "bg-indigo-500 hover:bg-indigo-600"}`}
              title="Members"
            >
              {getInitials(user?.fullName ?? "?")}
              <span className="absolute -bottom-1 -right-1 min-w-[16px] h-4 rounded-full bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-800 text-[9px] font-bold flex items-center justify-center px-0.5">
                {memberCount}
              </span>
            </button>
          </div>
        </div>

      {/* Chat body */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {fetchError && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-gray-400">{fetchError}</p>
            <button onClick={retryLoad} className="text-sm text-brand-500 hover:underline">Try again</button>
          </div>
        )}

        {!isLoading && !fetchError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-500 text-white text-2xl font-medium">
              #
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">Welcome to #{channelName}</h2>
              <p className="text-sm text-gray-400 mt-1">This is the beginning of the #{channelName} channel. Send a message to get started.</p>
            </div>
          </div>
        )}

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
                    const senderName = isMe ? (user?.fullName ?? "Me") : (msg.sender?.fullName ?? "Unknown");
                    const senderInitials = isMe ? myInitials : getInitials(senderName);
                    const senderColor = "#6366f1";
                    const senderAvatarUrl = isMe ? (user?.avatarUrl ?? null) : (msg.sender?.avatarUrl ?? null);
                    const isEditing = editingMsg?.id === msg.id;

                    if (isEditing) {
                      return (
                        <div key={msg.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal shrink-0 mt-0.5 overflow-hidden" style={{ backgroundColor: senderColor }}>
                            {senderAvatarUrl ? <img src={senderAvatarUrl} alt={senderName} className="w-full h-full object-cover" /> : senderInitials}
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
                              <button onClick={handleEditSave} disabled={isSavingEdit || !editText.trim()}
                                className="px-3 py-1 text-xs font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                                {isSavingEdit ? "Saving…" : "Save"}
                              </button>
                              <button onClick={handleEditCancel}
                                className="px-3 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
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
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {typingUserIds.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                  <span className="text-xs text-gray-400">
                    {typingUserIds.length === 1 ? "Someone is typing…" : `${typingUserIds.length} people are typing…`}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

        <DmMessageInput
          recipientName={channelName}
          channelId={channelId}
          onTypingStart={sendTypingStart}
          onTypingStop={sendTypingStop}
        />
      </div>

      {/* Members sidebar */}
      <div
        className={`shrink-0 border-l border-gray-100 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out ${
          showMembersSidebar ? "w-72 opacity-100" : "w-0 opacity-0 border-l-0"
        }`}
      >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Followers</h3>
            <button
              onClick={() => setShowMembersSidebar(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-4">
            <button
              onClick={() => setMembersTab("followers")}
              className={`flex items-center gap-1.5 py-2.5 text-sm border-b-2 mr-4 -mb-px transition-colors ${
                membersTab === "followers"
                  ? "border-brand-500 text-brand-500 font-medium"
                  : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Followers
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-medium">
                {members.length}
              </span>
            </button>
            <button
              onClick={() => setMembersTab("access")}
              className={`flex items-center gap-1.5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                membersTab === "access"
                  ? "border-brand-500 text-brand-500 font-medium"
                  : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Access
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-medium">
                {workspaceMembers.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 shrink-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search people or invite by email"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {membersTab === "followers" ? (
              <>
                {/* Add People button */}
                <button
                  onClick={() => setMembersTab("access")}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-1"
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  Add People
                </button>

                {/* Followers label */}
                {filteredFollowers.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mt-2 mb-1">
                    Followers
                  </p>
                )}
                {filteredFollowers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-normal shrink-0 overflow-hidden">
                      {m.user.avatarUrl ? (
                        <img src={m.user.avatarUrl} alt={m.user.fullName} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(m.user.fullName)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{m.user.fullName}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{m.role.toLowerCase()}</p>
                    </div>
                  </div>
                ))}

                {filteredFollowers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No followers yet</p>
                )}
              </>
            ) : (
              <>
                {/* Access tab — all workspace members, grouped by membership */}
                {(() => {
                  const followers = filteredAccess.filter((m) => memberUserIds.has(m.id));
                  const notFollowing = filteredAccess.filter((m) => !memberUserIds.has(m.id));
                  return (
                    <>
                      {followers.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mt-1 mb-1">
                            Followers
                          </p>
                          {followers.map((m) => (
                            <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-normal shrink-0">
                                {getInitials(m.fullName)}
                              </div>
                              <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{m.fullName}</p>
                            </div>
                          ))}
                        </>
                      )}

                      {notFollowing.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mt-3 mb-1">
                            Not Following
                          </p>
                          {notFollowing.map((m) => (
                            <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-normal shrink-0">
                                {getInitials(m.fullName)}
                              </div>
                              <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{m.fullName || m.email}</p>
                              <button
                                onClick={() => handleAddMember(m.id)}
                                disabled={addingUserId === m.id}
                                className="opacity-0 group-hover:opacity-100 text-xs text-brand-500 hover:text-brand-600 font-medium transition-all disabled:opacity-50 shrink-0"
                              >
                                {addingUserId === m.id ? "Adding…" : "Add"}
                              </button>
                            </div>
                          ))}
                        </>
                      )}

                      {filteredAccess.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No workspace members found</p>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
  );
}
