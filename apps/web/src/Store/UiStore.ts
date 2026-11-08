import { create } from "zustand";

export type LaunchTab = "expense" | "income" | "credit" | "extra" | "goal";

interface UiState {
  launchOpen: boolean;
  launchTab: LaunchTab;
  openLaunch: (tab?: LaunchTab) => void;
  closeLaunch: () => void;
  /** um tour está aberto: telas sem dados do usuário mostram exemplos para as etapas terem o que destacar */
  tourDemo: boolean;
  setTourDemo: (on: boolean) => void;
}

/** Estado só de tela: o modal "Lançar" é aberto de qualquer lugar. */
export const useUiStore = create<UiState>((set) => ({
  launchOpen: false,
  launchTab: "expense",
  openLaunch: (tab) => set((s) => ({ launchOpen: true, launchTab: tab ?? s.launchTab })),
  closeLaunch: () => set({ launchOpen: false }),
  tourDemo: false,
  setTourDemo: (on) => set({ tourDemo: on }),
}));
