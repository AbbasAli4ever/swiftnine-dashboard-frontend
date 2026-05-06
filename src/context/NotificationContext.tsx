"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { notificationService } from "@/services/notification.service";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { Notification } from "@/types/notification";

interface NotificationContextValue {
  notifications: Notification[];
  replies: Notification[];
  assignedComments: Notification[];
  unreadCount: number;
  isLoading: boolean;
  memberName: (userId: string) => string;
  clearNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  snoozeNotification: (id: string, until?: string) => Promise<void>;
  unsnoozeNotification: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function isPrimaryNotification(item: Notification): boolean {
  return !item.isCleared && !item.isSnoozed;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const storeMembers = useWorkspaceStore((s) => s.members);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const notificationsRef = useRef(notifications);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  const { showNotification } = useSystemNotifications();

  const memberMap = useMemo(
    () => new Map(storeMembers.map((m) => [m.id, m.fullName])),
    [storeMembers]
  );

  useEffect(() => {
    const userId = user?.id;
    if (!isAuthenticated || !userId || !activeWorkspaceId) return;

    setIsLoading(true);
    const ctrl = new AbortController();

    // Safety net: if onInit hasn't fired within 8 s (e.g. first attempt failed
    // and reconnect is in progress), stop showing the loading spinner so the
    // inbox renders with whatever data is available.
    const loadingTimeout = setTimeout(() => setIsLoading(false), 8_000);

    notificationService.openStream(
      user.id,
      {
        onInit: (items) => {
          clearTimeout(loadingTimeout);
          setNotifications(items.filter(isPrimaryNotification));
          setIsLoading(false);
        },
        onCreated: (item) => {
          if (!isPrimaryNotification(item)) return;
          setNotifications((prev) => [item, ...prev]);

          const isChatNotif = item.type === "chat:message" || item.type === "chat:mention";
          if (!isChatNotif) return;

          const senderName = memberMap.get(item.actorId ?? "") || "Someone";
          const body = item.message ?? item.title;

          // In-app toast — always show when the page is open
          const channelPath = item.type === "chat:mention"
            ? `/messages/${item.referenceId}`
            : `/channels/${item.referenceId}`;

          toast(senderName, {
            description: body,
            duration: 5000,
            position: "bottom-right",
            action: item.referenceId
              ? { label: "View", onClick: () => router.push(channelPath) }
              : undefined,
          });

          // System notification — only when tab is backgrounded to avoid double-notifying
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            showNotification(senderName, { body, tag: item.id });
          }
        },
        onUpdated: (item) => {
          if (!isPrimaryNotification(item)) {
            // Cleared or snoozed — remove from primary list
            setNotifications((prev) => prev.filter((n) => n.id !== item.id));
          } else {
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === item.id);
              if (exists) {
                // Already in list — update in place
                return prev.map((n) => (n.id === item.id ? { ...n, ...item } : n));
              }
              // Was cleared/snoozed before — prepend back to primary
              return [item, ...prev];
            });
          }
        },
      },
      ctrl.signal
    );

    return () => { clearTimeout(loadingTimeout); ctrl.abort(); };
  }, [isAuthenticated, user?.id, activeWorkspaceId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const replies = useMemo(
    () => notifications.filter((n) => n.type === "comment:reply"),
    [notifications]
  );

  const assignedComments = useMemo(
    () => notifications.filter((n) => n.type === "mentioned"),
    [notifications]
  );

  const memberName = useCallback((userId: string): string => {
    return memberMap.get(userId) ?? userId;
  }, [memberMap]);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationService.patchRead(id, true);
    } catch {
      toast.error("Failed to mark notification as read");
    }
  }, []);

  const markUnread = useCallback(async (id: string) => {
    try {
      await notificationService.patchRead(id, false);
    } catch {
      toast.error("Failed to mark notification as unread");
    }
  }, []);

  const clearNotification = useCallback(async (id: string) => {
    try {
      await notificationService.patchClear(id, true);
    } catch {
      toast.error("Failed to clear notification");
    }
  }, []);

  const clearAll = useCallback(async () => {
    const ids = notificationsRef.current.map((n) => n.id);
    if (!ids.length) return;
    const results = await Promise.allSettled(
      ids.map((id) => notificationService.patchClear(id, true))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) toast.error(`Failed to clear ${failed} notification(s)`);
  }, []);

  const snoozeNotification = useCallback(async (id: string, until?: string) => {
    try {
      await notificationService.patchSnooze(id, true, until);
    } catch {
      toast.error("Failed to snooze notification");
    }
  }, []);

  const unsnoozeNotification = useCallback(async (id: string) => {
    try {
      await notificationService.patchSnooze(id, false);
    } catch {
      toast.error("Failed to unsnooze notification");
    }
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      replies,
      assignedComments,
      unreadCount,
      isLoading,
      memberName,
      clearNotification,
      clearAll,
      snoozeNotification,
      unsnoozeNotification,
      markRead,
      markUnread,
    }),
    [
      notifications,
      replies,
      assignedComments,
      unreadCount,
      isLoading,
      memberName,
      clearNotification,
      clearAll,
      snoozeNotification,
      unsnoozeNotification,
      markRead,
      markUnread,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
