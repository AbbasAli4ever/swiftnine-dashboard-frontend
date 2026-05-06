import { api } from "@/lib/api";
import type { Channel } from "@/types/channel";
import type { ChannelMember } from "@/types/chat";

export const channelService = {
  getChannels: async (workspaceId: string): Promise<Channel[]> => {
    const { data } = await api.get<{ data: Channel[] }>(
      `/channels/workspaces/${workspaceId}`
    );
    return data.data;
  },

  createChannel: async (
    name: string,
    privacy: "PUBLIC" | "PRIVATE",
    description?: string
  ): Promise<Channel> => {
    const body: Record<string, unknown> = { name, privacy };
    if (description?.trim()) body.description = description.trim();
    const { data } = await api.post<{ data: Channel }>("/channels", body);
    return data.data;
  },

  addMember: async (
    channelId: string,
    userId: string,
    role: "admin" | "member" = "member"
  ): Promise<ChannelMember> => {
    const { data } = await api.post<{ data: ChannelMember }>(
      `/channels/${channelId}/members`,
      { userId, role }
    );
    return data.data;
  },

  addMembers: async (
    channelId: string,
    members: { userId: string; role: "admin" | "member" }[]
  ): Promise<ChannelMember[]> => {
    const { data } = await api.post<{ data: ChannelMember[] }>(
      `/channels/${channelId}/members/bulk`,
      { members }
    );
    return data.data;
  },

  removeMember: async (channelId: string, memberId: string): Promise<void> => {
    await api.delete(`/channels/${channelId}/members/${memberId}`);
  },
};
