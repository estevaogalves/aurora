import { create } from "zustand";

export type LaunchTab = "expense" | "income" | "credit" | "extra" | "goal";

interface UiState {
  launchOpen: boolean;
  launchTab: LaunchTab;
  openLaunch: (tab?: LaunchTab) => void;
  closeLaunch: () => void;
}

/** Estado só de tela: o modal "Lançar" é aberto de qualquer lugar. */
export const useUiStore = create<UiState>((set) => ({
  launchOpen: false,
  launchTab: "expense",
  openLaunch: (tab) => set((s) => ({ launchOpen: true, launchTab: tab ?? s.launchTab })),
  closeLaunch: () => set({ launchOpen: false }),
}));
