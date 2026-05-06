"use client";

import React, { useRef, useState, useCallback } from "react";
import { chatService, buildContentJson } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  recipientName?: string;
  channelId?: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export default function DmMessageInput({
  recipientName,
  channelId,
  onTypingStart,
  onTypingStop,
}: Props) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const placeholder = recipientName
    ? `Write to ${recipientName}, press 'space' for AI, '/' for commands`
    : "Write a message...";

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop?.();
    }, 3000);
  }, [onTypingStart, onTypingStop]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  }, [onTypingStop]);

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingAttachmentId) return;
    if (!channelId) return;
    if (isSending) return;

    stopTyping();
    setIsSending(true);
    try {
      const contentJson = trimmed ? buildContentJson(trimmed) : { type: "doc", content: [] };
      const attachmentIds = pendingAttachmentId ? [pendingAttachmentId] : undefined;
      await chatService.sendMessage(channelId, contentJson, attachmentIds);
      setText("");
      setPendingAttachmentId(null);
      setPendingFileName(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.code === "TOO_MANY_REQUESTS") {
        toast.error("Sending too fast. Please slow down.");
      } else {
        toast.error(parsed.message || "Failed to send. Try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
      return;
    }
    startTyping();
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleBlur = () => stopTyping();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
    // Reset so same file can be re-selected
    e.target.value = "";

    setIsUploading(true);
    setPendingAttachmentId(null);
    setPendingFileName(null);

    try {
      const presign = await chatService.presignAttachment(
        channelId,
        file.type || "application/octet-stream",
        file.name,
        file.size
      );
      await chatService.uploadToS3(presign.uploadUrl, file);
      setPendingAttachmentId(presign.attachmentId);
      setPendingFileName(file.name);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "File upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const removePendingAttachment = () => {
    setPendingAttachmentId(null);
    setPendingFileName(null);
  };

  const isDisabled = isSending || isUploading;
  const canSend = (text.trim().length > 0 || !!pendingAttachmentId) && !isDisabled && !!channelId;

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0">
      {/* Pending attachment pill */}
      {(pendingFileName || isUploading) && (
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-fit max-w-full">
          {isUploading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-400">Uploading…</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
              </svg>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{pendingFileName}</span>
              <button
                type="button"
                onClick={removePendingAttachment}
                className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                aria-label="Remove attachment"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={1}
          disabled={isDisabled}
          className="w-full resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none leading-5 disabled:opacity-50"
          style={{ minHeight: "20px", maxHeight: "160px", overflowY: "auto" }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* + */}
            <IconBtn label="Add" disabled={isDisabled}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </IconBtn>

            {/* Emoji (placeholder) */}
            <IconBtn label="Emoji" disabled={isDisabled}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.25 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" />
              </svg>
            </IconBtn>

            {/* Attach file */}
            <IconBtn
              label="Attach"
              disabled={isDisabled || !channelId}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </IconBtn>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            />

            {/* @ mention (placeholder) */}
            <IconBtn label="Mention" disabled={isDisabled}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
              </svg>
            </IconBtn>

            {/* # tag (placeholder) */}
            <IconBtn label="Tag" disabled={isDisabled}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
              </svg>
            </IconBtn>
          </div>

          <div className="flex items-center gap-1">
            {/* Help */}
            <IconBtn label="Help">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </IconBtn>

            {/* Send button */}
            <button
              type="button"
              onClick={doSend}
              disabled={!canSend}
              aria-label="Send message"
              className="flex items-center justify-center w-7 h-7 rounded-md text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
