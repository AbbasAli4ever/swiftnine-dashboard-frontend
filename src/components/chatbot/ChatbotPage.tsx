"use client";

import { useEffect, useRef, useState } from "react";
import { LuBotMessageSquare, LuSparkles } from "react-icons/lu";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useChatConversations, deriveTitle, type ChatMessage } from "@/hooks/useChatConversations";
import {
  chatbotService,
  ChatbotHttpError,
  type ChatCompletionMessage,
} from "@/services/chatbot.service";
import ChatMessageBubble from "@/components/chatbot/ChatMessageBubble";
import ChatMessageInput from "@/components/chatbot/ChatMessageInput";
import ChatTypingIndicator from "@/components/chatbot/ChatTypingIndicator";

const SUGGESTED_PROMPTS = [
  "Help me draft a project update email",
  "Explain a tricky concept simply",
  "Brainstorm ideas for a new feature",
  "Summarize this text for me",
];

function ChatWelcome({ onPrompt }: { onPrompt: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center px-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-swiftnine-gradient blur-lg opacity-40" />
        <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-swiftnine-gradient text-white shadow-theme-md">
          <LuBotMessageSquare className="w-7 h-7" />
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SwiftBot</h2>
        <p className="text-sm text-gray-400 mt-1">Your SwiftNine AI assistant. Ask me anything.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="flex items-center gap-2 text-left px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
          >
            <LuSparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="truncate">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const FALLBACK_ERROR_TEXT = "Sorry, something went wrong. Please try again.";

export default function ChatbotPage() {
  const { user } = useAuth();
  const userName = user?.fullName ?? "You";
  const {
    activeConversation,
    activeConversationId,
    createConversation,
    appendMessage,
    insertLocalMessage,
    persistMessage,
    updateLastMessage,
    removeLastMessage,
  } = useChatConversations();

  const [isStreaming, setIsStreaming] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, awaitingFirstToken]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  // Streams a completion for `apiMessages` into `conversationId`, handling the
  // token-by-token cache updates and the final persist/abort/error paths.
  // Shared by both a fresh send and a regenerate-last-response retry.
  const runCompletion = async (conversationId: string, apiMessages: ChatCompletionMessage[]) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setAwaitingFirstToken(true);

    const assistantMessageId = crypto.randomUUID();
    const assistantCreatedAt = new Date().toISOString();
    let buffer = "";
    let started = false;

    try {
      await chatbotService.streamCompletion(
        apiMessages,
        (token) => {
          buffer += token;
          if (!started) {
            started = true;
            setAwaitingFirstToken(false);
            insertLocalMessage(conversationId, {
              id: assistantMessageId,
              role: "assistant",
              content: buffer,
              createdAt: assistantCreatedAt,
            });
          } else {
            updateLastMessage(conversationId, buffer);
          }
        },
        controller.signal
      );
      if (started) {
        await persistMessage(conversationId, {
          id: assistantMessageId,
          role: "assistant",
          content: buffer,
          createdAt: assistantCreatedAt,
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (started && buffer.length > 0) {
          await persistMessage(conversationId, {
            id: assistantMessageId,
            role: "assistant",
            content: buffer,
            status: "aborted",
            createdAt: assistantCreatedAt,
          });
        }
      } else {
        if (err instanceof ChatbotHttpError && err.status === 429) {
          toast.error(
            "SwiftBot is getting a lot of requests right now — please wait a moment and try again."
          );
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to get a response.");
        }
        if (!started) {
          await appendMessage(conversationId, {
            id: assistantMessageId,
            role: "assistant",
            content: FALLBACK_ERROR_TEXT,
            createdAt: assistantCreatedAt,
          });
        }
      }
    } finally {
      setIsStreaming(false);
      setAwaitingFirstToken(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async (text: string) => {
    const conversationId = activeConversationId ?? (await createConversation());
    // A conversation with no messages yet has no title — true whether it was
    // just created above or was already sitting empty (e.g. from clicking
    // "New chat" in the panel before typing anything).
    const isFirstMessage = messages.length === 0;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    // Fire-and-forget: persists immediately so the turn survives even if the
    // OpenAI stream that follows fails or is aborted.
    void appendMessage(conversationId, userMessage, {
      title: isFirstMessage ? deriveTitle(text) : undefined,
    });

    const apiMessages: ChatCompletionMessage[] = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await runCompletion(conversationId, apiMessages);
  };

  const retryLastMessage = async () => {
    if (isStreaming || !activeConversationId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    await removeLastMessage(activeConversationId);
    const apiMessages: ChatCompletionMessage[] = messages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    await runCompletion(activeConversationId, apiMessages);
  };

  const showWelcome = !activeConversation || messages.length === 0;
  const canRetry =
    !isStreaming && !showWelcome && messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-800 shrink-0">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-swiftnine-gradient text-white shrink-0">
          <LuBotMessageSquare className="w-3 h-3" />
        </span>
        <h1 className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
          {activeConversation?.title ?? "SwiftBot"}
        </h1>
      </div>

      {showWelcome && !isStreaming ? (
        <div className="flex-1 overflow-y-auto">
          <ChatWelcome onPrompt={handleSend} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.map((message, index) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              userName={userName}
              onRetry={canRetry && index === messages.length - 1 ? retryLastMessage : undefined}
            />
          ))}
          {awaitingFirstToken && <ChatTypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}

      <ChatMessageInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
    </div>
  );
}
