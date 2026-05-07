"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { chatService, buildContentJson } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import EmojiPicker from "@/components/ui/EmojiPicker";
import { getInitials } from "@/lib/getInitials";

interface MentionMember {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface Props {
  recipientName?: string;
  channelId?: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  enableMentions?: boolean;
  members?: MentionMember[];
}

export default function DmMessageInput({
  recipientName,
  channelId,
  onTypingStart,
  onTypingStop,
  enableMentions = false,
  members = [],
}: Props) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const placeholder = recipientName
    ? `Write to ${recipientName}, press 'space' for AI, '/' for commands`
    : "Write a message...";

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) =>
        m.fullName.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  const closeMentionDropdown = useCallback(() => {
    setMentionQuery(null);
    setMentionStartIndex(null);
    setMentionHighlightIndex(0);
  }, []);

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

  const selectMention = useCallback((member: MentionMember) => {
    if (mentionStartIndex === null) return;
    const before = text.slice(0, mentionStartIndex);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    const inserted = `@${member.fullName} `;
    const next = before + inserted + after;
    setText(next);
    setMentionedUserIds((ids) =>
      ids.includes(member.userId) ? ids : [...ids, member.userId]
    );
    closeMentionDropdown();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    });
  }, [text, mentionStartIndex, closeMentionDropdown]);

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingAttachmentId) return;
    if (!channelId) return;
    if (isSending) return;

    stopTyping();
    closeMentionDropdown();
    setIsSending(true);
    try {
      const contentJson = trimmed ? buildContentJson(trimmed) : { type: "doc", content: [] };
      const attachmentIds = pendingAttachmentId ? [pendingAttachmentId] : undefined;
      const mentionIds = mentionedUserIds.length > 0 ? mentionedUserIds : undefined;
      await chatService.sendMessage(channelId, contentJson, attachmentIds, mentionIds);
      setText("");
      setPendingAttachmentId(null);
      setPendingFileName(null);
      setMentionedUserIds([]);
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";

    if (enableMentions) {
      const cursor = el.selectionStart ?? val.length;
      const textUpToCursor = val.slice(0, cursor);
      const atMatch = textUpToCursor.match(/@([^@\s]*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionStartIndex(atMatch.index!);
        setMentionHighlightIndex(0);
      } else {
        closeMentionDropdown();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlightIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlightIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredMembers[mentionHighlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionDropdown();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
      return;
    }
    startTyping();
  };

  const handleBlur = () => stopTyping();

  // Close mention dropdown on outside click
  useEffect(() => {
    if (mentionQuery === null) return;
    const handler = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        closeMentionDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mentionQuery, closeMentionDropdown]);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
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

  const triggerMention = () => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const needsSpace = before.length > 0 && !before.endsWith(" ");
    const inserted = needsSpace ? " @" : "@";
    const next = before + inserted + after;
    setText(next);
    const newCursor = cursor + inserted.length;
    setMentionStartIndex(newCursor - 1);
    setMentionQuery("");
    setMentionHighlightIndex(0);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = newCursor;
      el.focus();
    });
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

      <div className="relative">
        {/* Mention dropdown */}
        {enableMentions && mentionQuery !== null && filteredMembers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Members</span>
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredMembers.map((m, i) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
                      i === mentionHighlightIndex
                        ? "bg-brand-50 dark:bg-brand-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-normal shrink-0 overflow-hidden">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.fullName} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(m.fullName)
                      )}
                    </div>
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{m.fullName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => { insertEmoji(emoji); }}
            onClose={() => setShowEmojiPicker(false)}
          />
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
              {/* Emoji */}
              <IconBtn
                label="Emoji"
                disabled={isDisabled}
                onClick={() => setShowEmojiPicker((v) => !v)}
                active={showEmojiPicker}
              >
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

              {/* @ mention — only shown in channels */}
              {enableMentions && (
                <IconBtn
                  label="Mention"
                  disabled={isDisabled}
                  onClick={triggerMention}
                  active={mentionQuery !== null}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
                  </svg>
                </IconBtn>
              )}

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
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-brand-50 dark:bg-brand-900/30 text-brand-500"
          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
