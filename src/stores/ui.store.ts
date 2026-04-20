import { create } from "zustand";

interface UiState {
  profilePanelOpen: boolean;
  openProfilePanel: () => void;
  closeProfilePanel: () => void;
  toggleProfilePanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  profilePanelOpen: false,
  openProfilePanel: () => set({ profilePanelOpen: true }),
  closeProfilePanel: () => set({ profilePanelOpen: false }),
  toggleProfilePanel: () => set((s) => ({ profilePanelOpen: !s.profilePanelOpen })),
}));
