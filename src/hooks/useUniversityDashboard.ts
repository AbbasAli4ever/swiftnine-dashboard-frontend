"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useUniversityStore } from "@/stores/university.store";
import { getDashboardStats, getMyCourses } from "@/services/university.service";

export function useUniversityDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const {
    dashboardStats,
    dashboardCourses,
    dashboardLoaded,
    dashboardError,
    setDashboard,
    setDashboardError,
  } = useUniversityStore();

  useEffect(() => {
    // Skip if already cached or no token yet
    if (!accessToken || dashboardLoaded) return;

    let cancelled = false;

    Promise.all([getDashboardStats(), getMyCourses(1, 3)])
      .then(([stats, coursesRes]) => {
        if (!cancelled) setDashboard(stats, coursesRes.data);
      })
      .catch(() => {
        if (!cancelled) setDashboardError("Failed to load dashboard data");
      });

    return () => { cancelled = true; };
  }, [accessToken, dashboardLoaded, setDashboard, setDashboardError]);

  return {
    stats: dashboardStats,
    myCourses: dashboardCourses,
    isLoading: !dashboardLoaded,
    error: dashboardError,
  };
}
