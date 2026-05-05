"use client";

import { useState } from "react";
import { MOCK_DM_USERS } from "@/lib/mock-dm-data";
import { getInitials } from "@/lib/getInitials";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import DmMessageInput from "@/components/dm/DmMessageInput";

export default function MessagesPage() {
  const [query, setQuery] = useState("");
  const { openDmThread } = useUiStore();
  const router = useRouter();

  const filtered = MOCK_DM_USERS.filter(
    (u) =>
      u.fullName.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (userId: string) => {
    openDmThread(userId);
    router.push(`/messages/${userId}`);
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
            placeholder="Search people or enter an email to invite them"
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
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-normal"
                    style={{ backgroundColor: u.avatarColor }}
                  >
                    {getInitials(u.fullName)}
                  </div>
                  {u.status === "ONLINE" && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{u.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span className={`text-xs font-normal ${u.status === "ONLINE" ? "text-green-500" : "text-gray-400"}`}>
                  {u.status === "ONLINE" ? "Online" : "Offline"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <DmMessageInput />
    </div>
  );
}
