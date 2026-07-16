"use client";

import React, { useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { LuPaperclip, LuImage, LuFileText, LuPresentation } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { uploadChatAttachment } from "@/lib/uploadChatAttachment";
import ChatAttachmentChip, { type AttachmentDraft } from "@/components/chatbot/ChatAttachmentChip";

export interface ChatComposerAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  previewUrl?: string;
}

type ComposerMode = "chat" | "image" | "pdf" | "ppt";

interface Props {
  onSend: (text: string, attachments: ChatComposerAttachment[]) => void;
  onGenerateImage: (prompt: string) => void;
  onGenerateDocument: (prompt: string, kind: "pdf" | "ppt") => void;
  isStreaming: boolean;
  isGeneratingImage: boolean;
  isGeneratingDocument: boolean;
  onStop: () => void;
  disabled?: boolean;
  /** Lazily creates a conversation the first time a file is dropped, before any message is sent. */
  ensureConversationId: () => Promise<string>;
}

const MODE_PLACEHOLDER: Record<ComposerMode, string> = {
  chat: "Message SwiftBot...",
  image: "Describe the image you want to generate...",
  pdf: "Describe the PDF document you want to generate...",
  ppt: "Describe the presentation you want to generate...",
};

// Server enforces the exact per-attachment-type limit on presign; this is
// just a coarse client-side sanity gate against the largest allowed type.
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function ChatMessageInput({
  onSend,
  onGenerateImage,
  onGenerateDocument,
  isStreaming,
  isGeneratingImage,
  isGeneratingDocument,
  onStop,
  disabled,
  ensureConversationId,
}: Props) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [mode, setMode] = useState<ComposerMode>("chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = isStreaming || isGeneratingImage || isGeneratingDocument;
  const isDisabled = disabled || isBusy;
  const hasBlockingAttachments = drafts.some((d) => d.status === "uploading");
  const hasUploadedAttachments = drafts.some((d) => d.status === "uploaded");
  const canSend =
    mode === "chat"
      ? (text.trim().length > 0 || hasUploadedAttachments) && !isDisabled && !hasBlockingAttachments
      : text.trim().length > 0 && !isDisabled;

  const toggleMode = (target: ComposerMode) => {
    setMode((m) => (m === target ? "chat" : target));
  };

  const runUpload = async (localId: string, file: File) => {
    try {
      const conversationId = await ensureConversationId();
      const { attachmentId, s3Key } = await uploadChatAttachment(file, conversationId, (progress) =>
        setDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, progress } : d)))
      );
      setDrafts((prev) =>
        prev.map((d) =>
          d.localId === localId ? { ...d, status: "uploaded", attachmentId, s3Key, progress: 100 } : d
        )
      );
    } catch (err) {
      const message = parseApiError(err).message || `Failed to upload "${file.name}"`;
      setDrafts((prev) =>
        prev.map((d) => (d.localId === localId ? { ...d, status: "error", error: message } : d))
      );
    }
  };

  const addFiles = (files: File[]) => {
    files.forEach((file) => {
      const localId = crypto.randomUUID();
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setDrafts((prev) => [...prev, { localId, file, previewUrl, status: "uploading", progress: 0 }]);
      void runUpload(localId, file);
    });
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    maxSize: MAX_FILE_SIZE,
    onDrop: (accepted: File[], rejected: FileRejection[]) => {
      if (accepted.length) addFiles(accepted);
      rejected.forEach((r) =>
        toast.error(`"${r.file.name}": ${r.errors[0]?.message ?? "File rejected"}`)
      );
    },
  });

  const handleRetry = (localId: string) => {
    const draft = drafts.find((d) => d.localId === localId);
    if (!draft) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.localId === localId ? { ...d, status: "uploading", progress: 0, error: undefined } : d
      )
    );
    void runUpload(localId, draft.file);
  };

  const handleRemove = (localId: string) => {
    setDrafts((prev) => {
      const target = prev.find((d) => d.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.localId !== localId);
    });
  };

  const handleSend = () => {
    if (!canSend) return;
    const trimmed = text.trim();

    if (mode === "image") {
      onGenerateImage(trimmed);
    } else if (mode === "pdf" || mode === "ppt") {
      onGenerateDocument(trimmed, mode);
    } else {
      const ready = drafts.filter((d) => d.status === "uploaded");
      onSend(
        trimmed,
        ready.map((d) => ({
          attachmentId: d.attachmentId!,
          fileName: d.file.name,
          mimeType: d.file.type || "application/octet-stream",
          fileSize: d.file.size,
          s3Key: d.s3Key!,
          previewUrl: d.previewUrl,
        }))
      );
      setDrafts([]);
    }

    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0">
      <div
        {...getRootProps()}
        className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 flex flex-col gap-2"
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-brand-500/10 backdrop-blur-[1px]">
            <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
              Drop files to attach
            </p>
          </div>
        )}

        {drafts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {drafts.map((draft) => (
              <ChatAttachmentChip
                key={draft.localId}
                draft={draft}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={MODE_PLACEHOLDER[mode]}
          rows={1}
          disabled={isDisabled}
          className="w-full resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none leading-5 disabled:opacity-50"
          style={{ minHeight: "20px", maxHeight: "160px", overflowY: "auto" }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={open}
              disabled={isDisabled || mode !== "chat"}
              aria-label="Attach file"
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
            >
              <LuPaperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleMode("image")}
              disabled={isDisabled}
              aria-label="Generate image"
              aria-pressed={mode === "image"}
              title="Generate an image"
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 ${
                mode === "image"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              }`}
            >
              <LuImage className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleMode("pdf")}
              disabled={isDisabled}
              aria-label="Generate PDF"
              aria-pressed={mode === "pdf"}
              title="Generate a PDF"
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 ${
                mode === "pdf"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              }`}
            >
              <LuFileText className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleMode("ppt")}
              disabled={isDisabled}
              aria-label="Generate PowerPoint"
              aria-pressed={mode === "ppt"}
              title="Generate a PowerPoint presentation"
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 ${
                mode === "ppt"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              }`}
            >
              <LuPresentation className="w-4 h-4" />
            </button>
          </div>

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="w-2 h-2 rounded-[2px] bg-current" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
              className="flex items-center justify-center w-7 h-7 rounded-md text-white bg-brand-500 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
