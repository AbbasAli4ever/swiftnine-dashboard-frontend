import { aiFetch, throwAiHttpError } from "@/services/ai/http";

export interface GeneratedImage {
  blob: Blob;
  mimeType: string;
  fileName: string;
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export const imageGenerationService = {
  async generate(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
    const res = await aiFetch("/api/chat/image", { prompt }, signal);
    if (!res.ok) throw await throwAiHttpError(res, "Image generation failed");

    const { b64Json, mimeType } = await res.json();
    const ext = mimeType.split("/")[1] ?? "png";
    return {
      blob: base64ToBlob(b64Json, mimeType),
      mimeType,
      fileName: `generated-image-${Date.now()}.${ext}`,
    };
  },
};
