"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, parseApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { queryKeys } from "@/queries/keys";

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

export function useProfile() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/user/profile");
      return data;
    },
    enabled: !!accessToken,
  });

  const fetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  };

  const update = async (payload: UpdateProfilePayload) => {
    const { data } = await api.patch<UserProfile>("/user/profile", payload);
    queryClient.setQueryData(queryKeys.profile(), data);
  };

  const reset = () => queryClient.removeQueries({ queryKey: queryKeys.profile() });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? parseApiError(query.error).message : null,
    fetch,
    update,
    reset,
  };
}

// Preserved alias — some call sites import useProfileStore directly.
export const useProfileStore = useProfile;
