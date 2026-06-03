"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import {
  getDashboardStats,
  getMyCourses,
  type DashboardStats,
  type MyCourse,
} from "@/services/university.service";

interface State {
  stats: DashboardStats | null;
  myCourses: MyCourse[];
  isLoading: boolean;
  error: string | null;
}

export function useUniversityDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [state, setState] = useState<State>({
    stats: null,
    myCourses: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Wait until the token is actually in the store — not just isAuthenticated flag
    if (!accessToken) return;

    let cancelled = false;

    Promise.all([getDashboardStats(), getMyCourses(1, 3)])
      .then(([stats, coursesRes]) => {
        if (!cancelled)
          setState({ stats, myCourses: coursesRes.data, isLoading: false, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setState((p) => ({ ...p, isLoading: false, error: "Failed to load dashboard data" }));
      });

    return () => { cancelled = true; };
  }, [accessToken]);

  return state;
}
