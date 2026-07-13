import { aiFetch, throwAiHttpError } from "@/services/ai/http";
import { api } from "@/lib/api";
import type { ChatAttachment } from "@/services/chatAttachment.service";

export interface DocumentSection {
  heading?: string;
  body?: string;
  bullets?: string[];
}

export interface GeneratedDocumentContent {
  title: string;
  sections: DocumentSection[];
}

export interface GenerateDocumentPayload {
  conversationId: string;
  messageId?: string;
  title: string;
  fileName?: string;
  sections: DocumentSection[];
}

export const documentGenerationService = {
  // Step 1: ask OpenAI (via a Next.js route) to turn a free-text prompt into
  // structured content — the backend only renders, it never talks to OpenAI.
  async draftContent(prompt: string, signal?: AbortSignal): Promise<GeneratedDocumentContent> {
    const res = await aiFetch("/api/chat/document", { prompt }, signal);
    if (!res.ok) throw await throwAiHttpError(res, "Document drafting failed");
    return res.json();
  },

  // Step 2: send the structured content to the NestJS backend, which renders
  // it into a file and stores it as an already-confirmed attachment.
  async generatePdf(payload: GenerateDocumentPayload): Promise<ChatAttachment> {
    const { data } = await api.post<{ data: ChatAttachment }>("/document-generation/pdf", payload);
    return data.data;
  },

  async generatePpt(payload: GenerateDocumentPayload): Promise<ChatAttachment> {
    const { data } = await api.post<{ data: ChatAttachment }>("/document-generation/ppt", payload);
    return data.data;
  },
};
