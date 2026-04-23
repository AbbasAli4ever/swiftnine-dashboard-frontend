import { api } from "@/lib/api";
import { UserProfile } from "@/hooks/useProfile";

export const userService = {
  getById: async (userId: string): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>(`/user/${userId}`);
    return data;
  },
};
