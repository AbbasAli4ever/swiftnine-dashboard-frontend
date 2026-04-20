"use client";

import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import UserProfilePanel from "@/components/user-profile/UserProfilePanel";
import { useUiStore } from "@/stores/ui.store";
import React, { useEffect } from "react";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const { profilePanelOpen, closeProfilePanel } = useUiStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const forcedModal = !workspacesLoading && isAuthenticated && workspaces.length === 0;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <AppSidebar />

      {/* Main area — shrinks when profile panel is open */}
      <div className={`flex flex-col min-w-0 ml-72 transition-all duration-200 ease-in-out ${profilePanelOpen ? "flex-1" : "flex-1"}`}>
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Profile panel — slides in beside the content (not over it) */}
      <UserProfilePanel isOpen={profilePanelOpen} onClose={closeProfilePanel} />

      <CreateWorkspaceModal isOpen={forcedModal} />
    </div>
  );
}
