"use client";

import { useCallback, useEffect } from "react";
import { chatService } from "@/services/chat.service";
import { channelService } from "@/services/channel.service";
import { useChatStore } from "@/stores/chat.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useAuthStore } from "@/stores/auth.store";
import type { ChatChannel } from "@/types/chat";

/**
 * Loads the workspace's channels and the caller's DMs into the chat store.
 *
 * The two come from different endpoints with different shapes, so they are
 * normalised here rather than at every call site:
 *
 * - The channel list omits `isArchived`/`isFavourite` at the top level, but
 *   both are present on `viewerMembership`. We hoist them so the rest of the
 *   app can read one consistent field.
 * - Only the DM endpoint returns `lastMessage`, so channel rows simply have
 *   none and the list falls back to showing no preview.
 */
export function useChatRooms() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selfId = useAuthStore((s) => s.user?.id);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const store = useChatStore.getState();
    store.setChannelsLoading(true);
    store.setChannelsError(null);

    try {
      const [channels, dms] = await Promise.all([
        channelService.getChannels(activeWorkspaceId),
        chatService.getDms(),
      ]);

      /* The channel list is not filtered by `kind` server-side, so it returns
         DMs too — and `GET /chat/dms` returns them again. Merging by id keeps
         one row per room; the DM entry wins because only that endpoint
         populates `lastMessage`, which the list preview needs. */
      const byId = new Map<string, ChatChannel>();
      for (const room of [...channels, ...dms]) {
        byId.set(room.id, {
          ...room,
          isArchived:
            room.isArchived ?? room.viewerMembership?.isArchived ?? false,
          isFavourite:
            room.isFavourite ?? room.viewerMembership?.isFavourite ?? false,
        });
      }

      store.setChannels(Array.from(byId.values()));

      // So "message this person" can resolve to an existing DM.
      if (selfId) {
        for (const dm of dms) {
          const other = dm.members.find((m) => m.userId !== selfId);
          if (other) store.setUserToChannelId(other.userId, dm.id);
        }
      }
    } catch {
      store.setChannelsError("Couldn't load conversations.");
    } finally {
      store.setChannelsLoading(false);
    }
  }, [activeWorkspaceId, selfId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reload: load };
}
