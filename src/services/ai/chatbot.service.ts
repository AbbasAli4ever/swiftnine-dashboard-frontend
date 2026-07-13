import { aiFetch, throwAiHttpError } from "@/services/ai/http";

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export const chatbotService = {
  async streamCompletion(
    messages: ChatCompletionMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await aiFetch("/api/chat", { messages }, signal);

    if (!res.ok || !res.body) {
      throw await throwAiHttpError(res, "Chat request failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onToken(decoder.decode(value, { stream: true }));
    }
  },
};
