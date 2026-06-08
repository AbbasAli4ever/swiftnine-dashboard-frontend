"use client";

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useUniversityStore } from "@/stores/university.store";
import { getCourses, type CoursesParams } from "@/services/university.service";

export function useCourseLibrary(params: CoursesParams) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { libraryCache, setLibraryCache } = useUniversityStore();

  const cacheKey = JSON.stringify(params);
  const cached = libraryCache[cacheKey];

  const fetch = useCallback(() => {
    if (!accessToken) return;

    getCourses(params)
      .then((res) => {
        setLibraryCache(cacheKey, {
          courses: res.data,
          total: res.meta.total,
          totalPages: res.meta.totalPages,
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, cacheKey]);

  useEffect(() => {
    // Skip fetch if we already have this page/filter cached
    if (cached) return;
    fetch();
  }, [cached, fetch]);

  return {
    courses: cached?.courses ?? [],
    total: cached?.total ?? 0,
    totalPages: cached?.totalPages ?? 1,
    isLoading: !cached,
    error: null,
    refetch: fetch,
  };
}
