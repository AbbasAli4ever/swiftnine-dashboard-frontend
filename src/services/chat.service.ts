import { api } from "@/lib/api";
import type {
  ChatMessage,
  DmChannel,
  PaginatedMessages,
  PresignResponse,
} from "@/types/chat";

export const chatService = {
  getDms: async (): Promise<DmChannel[]> => {
    const { data } = await api.get<{ data: DmChannel[] }>("/chat/dms");
    return data.data;
  },

  createOrGetDm: async (targetUserId: string): Promise<DmChannel> => {
    const { data } = await api.post<{ data: DmChannel }>("/chat/dm", {
      targetUserId,
    });
    return data.data;
  },

  getMessages: async (
    channelId: string,
    cursor?: string | null,
    limit = 50
  ): Promise<PaginatedMessages> => {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    const { data } = await api.get<{ data: PaginatedMessages }>(
      `/chat/channels/${channelId}/messages`,
      { params }
    );
    return data.data;
  },

  sendMessage: async (
    channelId: string,
    contentJson: Record<string, unknown>,
    attachmentIds?: string[],
    mentionedUserIds?: string[],
    replyToMessageId?: string
  ): Promise<ChatMessage> => {
    const body: Record<string, unknown> = { contentJson };
    if (attachmentIds?.length) body.attachmentIds = attachmentIds;
    if (mentionedUserIds?.length) body.mentionedUserIds = mentionedUserIds;
    if (replyToMessageId) body.replyToMessageId = replyToMessageId;
    const { data } = await api.post<{ data: ChatMessage }>(
      `/chat/channels/${channelId}/messages`,
      body
    );
    return data.data;
  },

  editMessage: async (
    messageId: string,
    contentJson: Record<string, unknown>
  ): Promise<ChatMessage> => {
    const { data } = await api.patch<{ data: ChatMessage }>(
      `/chat/messages/${messageId}`,
      { contentJson }
    );
    return data.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/chat/messages/${messageId}`);
  },

  markRead: async (
    channelId: string,
    lastReadMessageId: string
  ): Promise<void> => {
    await api.post(`/chat/channels/${channelId}/read`, { lastReadMessageId });
  },

  presignAttachment: async (
    channelId: string,
    mimeType: string,
    fileName: string,
    fileSize: number
  ): Promise<PresignResponse> => {
    const { data } = await api.post<{ data: PresignResponse }>(
      "/attachments/presign",
      {
        scope: "channel-message",
        channelId,
        mimeType,
        fileName,
        fileSize,
      }
    );
    return data.data;
  },

  uploadToS3: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      // intentionally no Content-Type header — S3 presigned URL requires none
    });
    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
    }
  },
};

export function buildContentJson(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
