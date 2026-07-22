"use client";

import { useAuth } from "@/context/AuthContext";
import { hasSessionExists } from "@/stores/auth.store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { TaskListProvider } from "@/context/TaskListContext";
import { DocsProvider } from "@/context/DocsContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import GlobalTaskDetailModal from "@/components/projects/GlobalTaskDetailModal";
import NotificationPermissionBanner from "@/components/ui/NotificationPermissionBanner";
import UserProfilePanel from "@/components/user-profile/UserProfilePanel";
import ViewUserProfilePanel from "@/components/user-profile/ViewUserProfilePanel";
import { useUiStore } from "@/stores/ui.store";
import React, { useEffect } from "react";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const { profilePanelOpen, closeProfilePanel, viewingUserId, closeUserPanel } = useUiStore();
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
    // Projects/lists/docs are only used by the dashboard (admin) area, so scope
    // their providers here instead of the root layout — otherwise they'd fetch
    // GET /projects and GET /docs on every route, including the university pages.
    <ProjectProvider>
    <TaskListProvider>
    <DocsProvider>
    <NotificationProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-907">
      {/* Header — full width, above everything */}
      <NotificationPermissionBanner />
      <AppHeader />

      {/* Body row: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar hasHeader={true} />

        {/* Main area — offset by sidebar width */}
        <div className="flex flex-col flex-1 min-w-0 ml-[320px] overflow-hidden">
          {/* Content row: main + profile panels side by side */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 border border-r border-b mr-2 mb-2 rounded-tr-lg rounded-br-lg border-gray-200 dark:border-gray-800  overflow-hidden">
              {children}
            </main>

            {/* Own profile panel — only covers content area */}
            <UserProfilePanel isOpen={profilePanelOpen} onClose={closeProfilePanel} />

            {/* Other user's profile panel — only covers content area */}
            <ViewUserProfilePanel userId={viewingUserId} onClose={closeUserPanel} />
          </div>
        </div>
      </div>

      <GlobalTaskDetailModal />
      <CreateWorkspaceModal isOpen={forcedModal} />
    </div>
    </NotificationProvider>
    </DocsProvider>
    </TaskListProvider>
    </ProjectProvider>
  );
}
