"use client";

import { api, parseApiError } from "@/lib/api";
import { create } from "zustand";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  designation: string | null;
  profilePicture: string | null;
  status: "ONLINE" | "OFFLINE";
  bio: string | null;
  timezone: string | null;
  showLocalTime: boolean;
  localTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfilePayload = Partial<
  Pick<UserProfile, "fullName" | "designation" | "bio" | "timezone" | "showLocalTime" | "status">
>;

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  update: (data: UpdateProfilePayload) => Promise<void>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetch: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<UserProfile>("/user/profile");
      set({ profile: data });
    } catch (err) {
      const { message } = parseApiError(err);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  update: async (payload: UpdateProfilePayload) => {
    const { data } = await api.patch<UserProfile>("/user/profile", payload);
    set({ profile: data });
  },

  reset: () => set({ profile: null, isLoading: false, error: null }),
}));

export function useProfile() {
  return useProfileStore();
}
