"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChannelStore } from "@/stores/channel.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useChannelList } from "@/hooks/useChannelList";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import CreateChannelModal from "@/components/channels/CreateChannelModal";
import AddMembersModal from "@/components/channels/AddMembersModal";
import type { Channel } from "@/types/channel";

export default function AllChannelsPage() {
  const router = useRouter();
  const setChannels = useChannelStore((s) => s.setChannels);
  const setActiveChannelId = useChannelStore((s) => s.setActiveChannelId);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  const { channels, isLoading: loading, error } = useChannelList();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState<Channel | null>(null);

  const allChannels = channels.filter((c) => c.kind === "CHANNEL");

  useEffect(() => {
    setChannels(allChannels.filter((c) => c.isMember));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  useEffect(() => {
    if (error) toast.error(parseApiError(error).message || "Failed to load channels");
  }, [error]);

  const filtered = allChannels.filter((ch) =>
    (ch.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (ch.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleClickChannel = (ch: Channel) => {
    setActiveChannelId(ch.id);
    router.push(`/channels/${ch.id}`);
  };

  const handleChannelCreated = (ch: Channel) => {
    queryClient.setQueryData<Channel[]>(
      queryKeys.channels(activeWorkspaceId),
      (prev) => (prev?.some((c) => c.id === ch.id) ? prev : [ch, ...(prev ?? [])])
    );
    setNewChannel(ch);
    setShowCreate(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">All Channels</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 dark:bg-brand-400 dark:text-black text-white hover:bg-brand-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Channel
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for Channels"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">
                  Channels and Spaces
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Topic
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Followers
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Last updated
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-gray-400 py-16">
                    {search ? "No channels match your search" : "No channels yet"}
                  </td>
                </tr>
              )}
              {filtered.map((ch) => (
                <tr
                  key={ch.id}
                  onClick={() => handleClickChannel(ch)}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-gray-400 font-medium text-base">#</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{ch.name ?? "Unnamed"}</p>
                        {ch.privacy === "PRIVATE" && (
                          <span className="text-[10px] text-gray-400">Private</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {ch.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {ch.members.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-gray-400">{formatDate(ch.updatedAt)}</span>
                      {ch.isMember && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">Following</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={handleChannelCreated}
        />
      )}
      {newChannel && (
        <AddMembersModal
          channelId={newChannel.id}
          channelName={newChannel.name}
          onClose={() => setNewChannel(null)}
          onDone={() => setNewChannel(null)}
        />
      )}
    </div>
  );
}
