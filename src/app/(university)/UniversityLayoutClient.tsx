"use client";

import { useAuth } from "@/context/AuthContext";
import { hasSessionExists } from "@/stores/auth.store";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import React, { useEffect } from "react";

export default function UniversityLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasSessionExists()) {
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || (!isAuthenticated && hasSessionExists())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#7C3AED] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f7fa] dark:bg-gray-900">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar hasHeader={true} />
        <div className="flex flex-col flex-1 min-w-0 ml-80 overflow-hidden">
          <main className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800 border border-t border-r border-b mr-2 mb-2 rounded-tr-lg rounded-br-lg border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
