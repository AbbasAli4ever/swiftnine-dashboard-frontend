"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import {
  getCourses,
  type CatalogCourse,
  type CoursesParams,
} from "@/services/university.service";

interface State {
  courses: CatalogCourse[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
}

export function useCourseLibrary(params: CoursesParams) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [state, setState] = useState<State>({
    courses: [],
    total: 0,
    totalPages: 1,
    isLoading: true,
    error: null,
  });

  const fetch = useCallback(() => {
    if (!accessToken) return;

    setState((p) => ({ ...p, isLoading: true, error: null }));

    getCourses(params)
      .then((res) => {
        setState({
          courses: res.data,
          total: res.meta.total,
          totalPages: res.meta.totalPages,
          isLoading: false,
          error: null,
        });
      })
      .catch(() => {
        setState((p) => ({ ...p, isLoading: false, error: "Failed to load courses" }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, JSON.stringify(params)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...state, refetch: fetch };
}
