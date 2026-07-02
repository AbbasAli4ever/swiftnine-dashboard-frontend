"use client";

import { useState } from "react";
import { getInitials } from "@/lib/getInitials";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useAuth } from "@/context/AuthContext";
import { chatService } from "@/services/chat.service";
import { useDmStore } from "@/stores/dm.store";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

export default function MessagesPage() {
  const [query, setQuery] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const { openDmThread } = useUiStore();
  const { setUserToChannelId, setDmChannels, dmChannels } = useDmStore();
  const router = useRouter();
  const { user } = useAuth();
  const { members } = useWorkspaceMembers();

  // Filter out self and match query
  const filtered = members.filter(
    (m) =>
      m.id !== user?.id &&
      (m.fullName.toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = async (memberId: string) => {
    if (loadingUserId) return;
    setLoadingUserId(memberId);
    try {
      const channel = await chatService.createOrGetDm(memberId);
      setUserToChannelId(memberId, channel.id);
      // Add to dm list if not already there
      const exists = dmChannels.some((c) => c.id === channel.id);
      if (!exists) setDmChannels([...dmChannels, channel]);
      openDmThread(memberId);
      router.push(`/messages/${memberId}`);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "Failed to open conversation");
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h1 className="text-base font-semibold text-gray-800 dark:text-white">New Direct Message</h1>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-colors"
          />
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No people found</p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((m) => {
              const isLoading = loadingUserId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  disabled={!!loadingUserId}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-60"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-normal bg-indigo-500">
                      {getInitials(m.fullName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{m.fullName}</p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  {isLoading && (
                    <svg className="w-4 h-4 animate-spin text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
