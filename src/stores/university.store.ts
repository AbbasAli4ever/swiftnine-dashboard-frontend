import { create } from "zustand";
import type { DashboardStats, MyCourse, CatalogCourse } from "@/services/university.service";

// ── Active course (used by MyLearning header) ─────────────────────────────────
interface ActiveCourseSlice {
  activeCoursTitle: string | null;
  activeCourseDescription: string | null;
  setActiveCourse: (title: string, description: string | null) => void;
  clearActiveCourse: () => void;
}

// ── Dashboard cache ───────────────────────────────────────────────────────────
interface DashboardSlice {
  dashboardStats: DashboardStats | null;
  dashboardCourses: MyCourse[];
  dashboardLoaded: boolean;
  dashboardError: string | null;
  setDashboard: (stats: DashboardStats, courses: MyCourse[]) => void;
  setDashboardError: (msg: string) => void;
  invalidateDashboard: () => void;
}

// ── Course library cache ──────────────────────────────────────────────────────
interface LibraryCacheEntry {
  courses: CatalogCourse[];
  total: number;
  totalPages: number;
}

interface LibrarySlice {
  libraryCache: Record<string, LibraryCacheEntry>;
  setLibraryCache: (key: string, entry: LibraryCacheEntry) => void;
  invalidateLibrary: () => void;
}

type UniversityState = ActiveCourseSlice & DashboardSlice & LibrarySlice;

export const useUniversityStore = create<UniversityState>((set) => ({
  // Active course
  activeCoursTitle: null,
  activeCourseDescription: null,
  setActiveCourse: (title, description) =>
    set({ activeCoursTitle: title, activeCourseDescription: description }),
  clearActiveCourse: () =>
    set({ activeCoursTitle: null, activeCourseDescription: null }),

  // Dashboard
  dashboardStats: null,
  dashboardCourses: [],
  dashboardLoaded: false,
  dashboardError: null,
  setDashboard: (stats, courses) =>
    set({ dashboardStats: stats, dashboardCourses: courses, dashboardLoaded: true, dashboardError: null }),
  setDashboardError: (msg) =>
    set({ dashboardError: msg, dashboardLoaded: true }),
  invalidateDashboard: () =>
    set({ dashboardLoaded: false, dashboardStats: null, dashboardCourses: [] }),

  // Library
  libraryCache: {},
  setLibraryCache: (key, entry) =>
    set((s) => ({ libraryCache: { ...s.libraryCache, [key]: entry } })),
  invalidateLibrary: () =>
    set({ libraryCache: {} }),
}));
