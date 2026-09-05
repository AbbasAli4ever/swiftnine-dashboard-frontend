"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatChannel } from "@/hooks/useChatRealtime";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { groupMessages } from "@/lib/chat/format";
import ChatMessageRow from "./ChatMessageRow";
import ChatComposer from "./ChatComposer";
import type { ChatChannel, ChatMessage } from "@/types/chat";

/**
 * The scrolling message list plus composer, shared by channels and DMs.
 *
 * Everything that differs between the two — header, onboarding, member
 * sidebar — lives in the panel that renders this, so the timeline itself has
 * exactly one implementation.
 */
export default function ChatThreadView({ room }: { room: ChatChannel }) {
  const { messages, isLoading, hasMore, loadOlder } = useChatMessages(room.id);
  const { sendTypingStart, sendTypingStop } = useChatChannel(room.id);
  const selfId = useAuthStore((s) => s.user?.id);
  const typingUsers = useChatStore((s) => s.typingByChannel[room.id]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);

  /* Member names resolve SYSTEM message text and @-mentions. */
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of room.members) map.set(m.userId, m.user.fullName);
    return map;
  }, [room.members]);

  const resolveName = useCallback(
    (id: string) => nameById.get(id) ?? "Someone",
    [nameById]
  );

  const mentionMembers = useMemo(
    () =>
      room.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
      })),
    [room.members]
  );

  const canModerate = useMemo(() => {
    const role = room.viewerMembership?.role;
    return role === "OWNER" || role === "ADMIN";
  }, [room.viewerMembership]);

  // Follow the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Infinite scroll upward for older history.
  useEffect(() => {
    const node = topSentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadOlder();
      },
      { rootMargin: "80px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadOlder]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      // One route toggles both ways; the socket echo updates the store.
      await chatService.toggleReaction(messageId, emoji);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't react.");
    }
  }, []);

  const handlePin = useCallback(async (message: ChatMessage) => {
    try {
      if (message.isPinned) await chatService.unpinMessage(message.id);
      else await chatService.pinMessage(message.id);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't update pin.");
    }
  }, []);

  const handleDelete = useCallback(async (message: ChatMessage) => {
    try {
      await chatService.deleteMessage(message.id);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete message.");
    }
  }, []);

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const typingNames = useMemo(() => {
    if (!typingUsers?.size) return [];
    return Array.from(typingUsers)
      .filter((id) => id !== selfId)
      .map((id) => resolveName(id));
  }, [typingUsers, selfId, resolveName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div ref={topSentinel} />
        {isLoading && messages.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Loading messages…
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-[11px] font-medium text-gray-400">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
            {group.messages.map((message) => (
              <ChatMessageRow
                key={message.id}
                message={message}
                selfUserId={selfId}
                resolveName={resolveName}
                canModerate={canModerate}
                onReact={handleReact}
                onReply={setReplyingTo}
                onPin={handlePin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="px-4 pb-1 text-xs italic text-gray-400">
          {typingNames.join(", ")}{" "}
          {typingNames.length === 1 ? "is" : "are"} typing…
        </p>
      )}

      <ChatComposer
        channelId={room.id}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTypingStart={sendTypingStart}
        onTypingStop={sendTypingStop}
        /* Mentions are offered in channels, where there is a roster worth
           picking from. In a two-person DM the other party is implicit. */
        enableMentions={room.kind === "CHANNEL"}
        members={mentionMembers}
      />
    </div>
  );
}
