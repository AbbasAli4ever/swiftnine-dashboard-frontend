import { NextRequest } from "next/server";
import OpenAI, { APIError } from "openai";

export const runtime = "nodejs";

const DRAFT_MODEL = "gpt-4o-mini";
const MAX_SECTIONS = 30;
const CHAT_MODEL_RATES = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
} as const;

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

interface DocumentRequestBody {
  prompt: string;
}

const SYSTEM_PROMPT = `You are a document drafting assistant. Given a user's request, produce structured content for a document (report, proposal, summary, or presentation).

Respond with ONLY a JSON object matching this exact shape:
{
  "title": string,
  "sections": [
    { "heading"?: string, "body"?: string, "bullets"?: string[] }
  ]
}

Rules:
- Include at most 30 sections.
- Each section must have either "body" or "bullets" (or both), never neither.
- Keep body text under 2000 characters per section.
- Keep bullets concise, at most 15 per section.
- Do not include markdown formatting, only plain text.
- Write complete, well-organized content that directly addresses the user's request.`;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader.trim() === "") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: DocumentRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: DRAFT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const usage = completion.usage;
    const estimatedCostUsd = estimateChatCostUsd(
      DRAFT_MODEL,
      usage?.prompt_tokens ?? 0,
      usage?.completion_tokens ?? 0
    );

    console.info("[SwiftBot cost basis] document draft request", {
      model: DRAFT_MODEL,
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      estimatedCostUsd,
      pricingBasis: "gpt-4o-mini: $0.15 / 1M input tokens + $0.60 / 1M output tokens",
      note: "This is the draft step only; final PDF/PPTX rendering happens in the backend document-generation API.",
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return new Response(JSON.stringify({ error: "No content generated" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "Model returned invalid JSON" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = parsed as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null || typeof record.title !== "string" || !Array.isArray(record.sections)) {
      return new Response(JSON.stringify({ error: "Model returned an unexpected shape" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ title: record.title, sections: record.sections.slice(0, MAX_SECTIONS) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const status = err instanceof APIError && err.status ? err.status : 500;
    const message = err instanceof Error ? err.message : "Document drafting failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
