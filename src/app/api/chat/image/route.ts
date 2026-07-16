import { NextRequest } from "next/server";
import OpenAI, { APIError } from "openai";

export const runtime = "nodejs";

const IMAGE_MODEL = "gpt-image-1";
const IMAGE_COSTS_BY_QUALITY_1024 = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
} as const;

interface ImageRequestBody {
  prompt: string;
}

function estimateImageCostUsd(size: string | undefined, quality: string | undefined): number | null {
  if (size && size !== "1024x1024") {
    return null;
  }

  const normalizedQuality = quality === "auto" ? "medium" : (quality ?? "medium");
  const cost = IMAGE_COSTS_BY_QUALITY_1024[
    normalizedQuality as keyof typeof IMAGE_COSTS_BY_QUALITY_1024
  ];

  return typeof cost === "number" ? cost : null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader.trim() === "") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ImageRequestBody;
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
    const result = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "auto",
      output_format: "png",
    });

    const estimatedCostUsd = estimateImageCostUsd(result.size, result.quality);
    console.info("[SwiftBot cost basis] image request", {
      model: IMAGE_MODEL,
      inputTokens: result.usage?.input_tokens ?? 0,
      outputTokens: result.usage?.output_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
      size: result.size ?? "1024x1024",
      quality: result.quality ?? "auto",
      estimatedCostUsd,
      pricingBasis: "gpt-image-1 legacy image-generation calculator estimate for a fixed 1024x1024 request",
    });

    const image = result.data?.[0];
    if (!image?.b64_json) {
      return new Response(JSON.stringify({ error: "No image returned" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        b64Json: image.b64_json,
        mimeType: `image/${result.output_format ?? "png"}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const status = err instanceof APIError && err.status ? err.status : 500;
    const message = err instanceof Error ? err.message : "Image generation failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
