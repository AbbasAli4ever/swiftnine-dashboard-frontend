import { create } from "zustand";

interface UiState {
  profilePanelOpen: boolean;
  openProfilePanel: () => void;
  closeProfilePanel: () => void;
  toggleProfilePanel: () => void;

  // View another user's profile
  viewingUserId: string | null;
  openUserPanel: (userId: string) => void;
  closeUserPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  profilePanelOpen: false,
  openProfilePanel: () => set({ profilePanelOpen: true }),
  closeProfilePanel: () => set({ profilePanelOpen: false }),
  toggleProfilePanel: () => set((s) => ({ profilePanelOpen: !s.profilePanelOpen })),

  viewingUserId: null,
  openUserPanel: (userId: string) => set({ viewingUserId: userId, profilePanelOpen: false }),
  closeUserPanel: () => set({ viewingUserId: null }),
}));
