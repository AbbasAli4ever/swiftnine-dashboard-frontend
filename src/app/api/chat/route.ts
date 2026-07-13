import { NextRequest } from "next/server";
import OpenAI, { APIError } from "openai";

export const runtime = "nodejs";

const CHAT_MODEL_RATES = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
} as const;

interface ChatRequestBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  model?: string;
}

function estimateChatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = CHAT_MODEL_RATES[model as keyof typeof CHAT_MODEL_RATES];
  if (!rate) return 0;

  return (promptTokens / 1_000_000) * rate.inputPerMillion +
    (completionTokens / 1_000_000) * rate.outputPerMillion;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader.trim() === "") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, model } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const resolvedModel = model ?? "gpt-4o-mini";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await client.chat.completions.create({
      model: resolvedModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });

    const encoder = new TextEncoder();
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));

            const usage = chunk.usage;
            if (usage) {
              promptTokens = usage.prompt_tokens;
              completionTokens = usage.completion_tokens;
              totalTokens = usage.total_tokens;
            }
          }

          const estimatedCostUsd = estimateChatCostUsd(
            resolvedModel,
            promptTokens,
            completionTokens
          );

          console.info("[SwiftBot cost basis] chat request", {
            model: resolvedModel,
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens,
            estimatedCostUsd,
            pricingBasis: "gpt-4o-mini: $0.15 / 1M input tokens + $0.60 / 1M output tokens",
          });
        } catch (err) {
          controller.error(err);
          return;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const status = err instanceof APIError && err.status ? err.status : 500;
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
