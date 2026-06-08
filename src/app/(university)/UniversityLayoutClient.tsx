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
    <div className="flex h-screen overflow-hidden bg-[#f5f7fa] dark:bg-gray-900">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 ml-[320px]">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-[#f5f7fa] dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
