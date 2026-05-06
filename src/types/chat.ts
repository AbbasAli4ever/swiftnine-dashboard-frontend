export type ChatUserSummary = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

export type ChatReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: ChatUserSummary;
};

export type ChatAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  s3Key: string;
  url?: string;
};

export type ChatReplyPreview = {
  id: string;
  senderId: string | null;
  kind: "USER" | "SYSTEM";
  plaintext: string;
  deletedAt: string | null;
  sender: ChatUserSummary | null;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string | null;
  kind: "USER" | "SYSTEM";
  contentJson: Record<string, unknown>;
  plaintext: string;
  replyToMessageId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender: ChatUserSummary | null;
  pinnedBy: ChatUserSummary | null;
  mentions: ChatUserSummary[];
  reactions: ChatReaction[];
  attachments: ChatAttachment[];
  replyTo: ChatReplyPreview | null;
};

export type ChannelMember = {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isMuted: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  joinedAt: string;
  user: ChatUserSummary;
};

export type DmChannel = {
  id: string;
  workspaceId: string;
  kind: "DM";
  privacy: "PRIVATE";
  name: string | null;
  description: string | null;
  projectId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isMember: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  viewerMembership: ChannelMember | null;
  members: ChannelMember[];
};

export type PresignResponse = {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  attachmentId: string;
};

export type PaginatedMessages = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type ReadReceiptEvent = {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  unreadCount: number;
  readAt: string;
};

export type PresenceChangedEvent = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
};
