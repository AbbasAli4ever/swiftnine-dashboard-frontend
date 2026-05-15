"use client";

import { useAuth } from "@/context/AuthContext";
import { hasSessionExists } from "@/stores/auth.store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NotificationProvider } from "@/context/NotificationContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import GlobalTaskDetailModal from "@/components/projects/GlobalTaskDetailModal";
import NotificationPermissionBanner from "@/components/ui/NotificationPermissionBanner";
import UserProfilePanel from "@/components/user-profile/UserProfilePanel";
import ViewUserProfilePanel from "@/components/user-profile/ViewUserProfilePanel";
import { useUiStore } from "@/stores/ui.store";
import { usePathname } from "next/navigation";
import React, { useEffect } from "react";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const { profilePanelOpen, closeProfilePanel, viewingUserId, closeUserPanel } = useUiStore();
  const pathname = usePathname();
  const isMessageQueuePage =
    pathname === "/replies" ||
    pathname === "/assigned-comments";

  useEffect(() => {
    // Only bounce to /signin when we are sure the user has never logged in on
    // this browser. If session_exists is set, AuthContext is still trying to
    // restore via /auth/refresh — don't race ahead with a redirect.
    if (!isLoading && !isAuthenticated && !hasSessionExists()) {
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || (!isAuthenticated && hasSessionExists())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const forcedModal = !workspacesLoading && isAuthenticated && workspaces.length === 0;

  return (
    <NotificationProvider>
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <AppSidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 ml-[320px]">
        <NotificationPermissionBanner />
        {!isMessageQueuePage && <AppHeader />}
        {/* Content row: main + profile panels side by side, below the header */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden">
            {children}
          </main>

          {/* Own profile panel — only covers content area */}
          <UserProfilePanel isOpen={profilePanelOpen} onClose={closeProfilePanel} />

          {/* Other user's profile panel — only covers content area */}
          <ViewUserProfilePanel userId={viewingUserId} onClose={closeUserPanel} />
        </div>
      </div>

      <GlobalTaskDetailModal />
      <CreateWorkspaceModal isOpen={forcedModal} />
    </div>
    </NotificationProvider>
  );
}
