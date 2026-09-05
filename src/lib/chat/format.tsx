import React from "react";
import type { ChatMessage } from "@/types/chat";

/**
 * Presentation helpers shared by every chat surface.
 *
 * Lifted verbatim out of `ChannelChatView`, where they were duplicated
 * near-identically in `DmChatView` — keeping them in one place is what lets
 * channels and DMs render consistently.
 */

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Today" / "Yesterday" / "Mon, Jan 5" — the timeline's day separator. */
export function getDateLabel(iso: string): string {
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

export function groupMessages(
  messages: ChatMessage[]
): { label: string; messages: ChatMessage[] }[] {
  const groups = new Map<string, ChatMessage[]>();
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }
  return Array.from(groups.entries()).map(([label, msgs]) => ({
    label,
    messages: msgs,
  }));
}

/**
 * Turns a SYSTEM message's structured `contentJson` into readable text.
 *
 * This is the only decoder of the server's system-event vocabulary — every
 * `kind: "SYSTEM"` row arrives as `{ event, ...args }` with no prose, so
 * without this they render blank.
 */
export function renderSystemText(
  contentJson: Record<string, unknown>,
  resolveName: (id: string) => string
): string {
  const event = contentJson.event as string | undefined;
  const actor = resolveName(
    ((contentJson.actorUserId ?? contentJson.actorId) as string) ?? ""
  );
  const user = resolveName((contentJson.userId as string) ?? "");

  switch (event) {
    case "channel_created":
      return `${actor} created this channel`;
    case "channel_renamed":
      return `${actor} renamed the channel from "${contentJson.from}" to "${contentJson.to}"`;
    case "channel_privacy_changed":
      return `${actor} changed the channel to ${
        (contentJson.to as string)?.toLowerCase() ?? "unknown"
      }`;
    case "member_joined":
      return contentJson.source === "join_request"
        ? `${user} joined the channel`
        : `${actor} added ${user} to the channel`;
    case "member_role_changed":
      return `${actor} changed ${user}'s role from ${contentJson.from} to ${contentJson.to}`;
    case "member_removed":
      return `${actor} removed ${user} from the channel`;
    case "dm_started":
      return `${actor} started this conversation`;
    default:
      return event ? event.replace(/_/g, " ") : "System event";
  }
}

/**
 * Highlights `@Name` spans in a message body.
 *
 * Matches on the mentioned person's name because mentions travel as plaintext
 * plus a separate id array rather than as rich-text nodes — so a renamed user
 * or a literal "@Name" in prose can mis-highlight. A ProseMirror mention node
 * would fix that; see the composer note in the migration plan.
 */
export function renderWithMentions(
  plaintext: string,
  mentions: ChatMessage["mentions"]
): React.ReactNode {
  if (!mentions.length) return plaintext;
  const parts: React.ReactNode[] = [];
  let remaining = plaintext;
  let key = 0;
  for (const mention of mentions) {
    const tag = `@${mention.fullName}`;
    const idx = remaining.indexOf(tag);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <span key={key++} className="font-medium text-brand-500">
        {tag}
      </span>
    );
    remaining = remaining.slice(idx + tag.length);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

/** Reactions grouped for display: one chip per emoji with a count. */
export function groupReactions(message: ChatMessage) {
  const byEmoji = new Map<
    string,
    { emoji: string; count: number; userIds: string[] }
  >();
  for (const r of message.reactions) {
    const entry = byEmoji.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      userIds: [],
    };
    entry.count += 1;
    entry.userIds.push(r.userId);
    byEmoji.set(r.emoji, entry);
  }
  return Array.from(byEmoji.values());
}

/**
 * A room's display title.
 *
 * DMs carry `name: null` server-side, so their title is the other
 * participant's name — which means the viewer's own id is needed to work out
 * who "the other" is.
 */
export function roomTitle(
  room: { kind: "CHANNEL" | "DM"; name: string | null; members: { userId: string; user: { fullName: string } }[] },
  selfUserId: string | undefined
): string {
  if (room.kind === "CHANNEL") return room.name ?? "Untitled channel";
  const other = room.members.find((m) => m.userId !== selfUserId);
  return other?.user.fullName ?? "Direct message";
}

/** Short preview line for the conversation list. */
export function lastMessagePreview(room: {
  lastMessage?: { plaintext: string; deletedAt: string | null } | null;
}): string {
  const last = room.lastMessage;
  if (!last) return "";
  if (last.deletedAt) return "Message deleted";
  return last.plaintext;
}
