import { create } from "zustand";

interface UniversityState {
  activeCoursTitle: string | null;
  activeCourseDescription: string | null;
  setActiveCourse: (title: string, description: string | null) => void;
  clearActiveCourse: () => void;
}

export const useUniversityStore = create<UniversityState>((set) => ({
  activeCoursTitle: null,
  activeCourseDescription: null,
  setActiveCourse: (title, description) => set({ activeCoursTitle: title, activeCourseDescription: description }),
  clearActiveCourse: () => set({ activeCoursTitle: null, activeCourseDescription: null }),
}));
