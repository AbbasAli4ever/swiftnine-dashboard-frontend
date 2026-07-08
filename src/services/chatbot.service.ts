import { getAccessToken } from "@/stores/auth.store";

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class ChatbotHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ChatbotHttpError";
  }
}

export const chatbotService = {
  async streamCompletion(
    messages: ChatCompletionMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = getAccessToken();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new ChatbotHttpError(body.error ?? `Chat request failed (${res.status})`, res.status);
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
