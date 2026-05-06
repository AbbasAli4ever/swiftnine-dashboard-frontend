import type { ChannelMember } from "@/types/chat";

export type { ChannelMember };

export type Channel = {
  id: string;
  workspaceId: string;
  kind: "CHANNEL";
  privacy: "PUBLIC" | "PRIVATE";
  name: string;
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
