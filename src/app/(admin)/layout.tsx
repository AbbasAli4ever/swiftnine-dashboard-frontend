"use client";

import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import React, { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Hard navigation — avoids RSC prefetch firing against the protected
      // route before the redirect, which would show a flash or extra requests.
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  // Still restoring session from the refresh cookie — don't flash the login page
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
      {/* Dual-column sidebar: 56px rail + 232px panel = 288px total */}
      <AppSidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 ml-72">
        <AppHeader />
        {/* Full-height content — no extra padding so inbox fills the pane */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Forced workspace creation — cannot be dismissed */}
      <CreateWorkspaceModal isOpen={forcedModal} />
    </div>
  );
}
