"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { channelService } from "@/services/channel.service";
import { useChannelStore } from "@/stores/channel.store";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import type { Channel } from "@/types/channel";

interface Props {
  onClose: () => void;
  onCreated?: (channel: Channel) => void;
}

export default function CreateChannelModal({ onClose, onCreated }: Props) {
  const router = useRouter();
  const addChannel = useChannelStore((s) => s.addChannel);
  const setActiveChannelId = useChannelStore((s) => s.setActiveChannelId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const channel = await channelService.createChannel(
        trimmed,
        isPrivate ? "PRIVATE" : "PUBLIC",
        description
      );
      addChannel(channel);
      setActiveChannelId(channel.id);
      onCreated?.(channel);
      onClose();
      router.push(`/channels/${channel.id}`);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Create Channel</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Chat Channels are where conversations happen. Use a name that is easy to find and understand.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors shrink-0 ml-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Ideas"
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {/* Make Private toggle */}
          <div className="flex items-start justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Make Private</p>
              <p className="text-xs text-gray-400 mt-0.5">Only you and invited members have access</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5 ${
                isPrivate ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  isPrivate ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
