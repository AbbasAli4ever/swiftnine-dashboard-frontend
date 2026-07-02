"use client";

import { useEffect, useState } from "react";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { channelService } from "@/services/channel.service";
import { getInitials } from "@/lib/getInitials";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  channelId: string;
  channelName: string;
  onClose: () => void;
  /** Called after members are successfully added or skipped */
  onDone: () => void;
}

export default function AddMembersModal({ channelId, channelName, onClose, onDone }: Props) {
  const { members, refetch: fetchMembers } = useWorkspaceMembers();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members.filter((m) =>
    m.fullName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) { onDone(); return; }
    setLoading(true);
    try {
      await channelService.addMembers(
        channelId,
        Array.from(selected).map((userId) => ({ userId, role: "member" as const }))
      );
      toast.success(`Added ${selected.size} member${selected.size > 1 ? "s" : ""} to #${channelName}`);
      onDone();
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "Failed to add members");
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Add followers to #{channelName}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              People have access to #{channelName}, but only followers will get notifications for new messages.
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

        {/* Search */}
        <div className="mt-4 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            autoFocus
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        {/* Member list */}
        <div className="mt-3 max-h-60 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No members found</p>
          )}
          {filtered.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? "bg-brand-50 dark:bg-brand-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-normal shrink-0 bg-indigo-500">
                  {getInitials(m.fullName)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-gray-800 dark:text-gray-200 truncate">{m.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            onClick={onDone}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
