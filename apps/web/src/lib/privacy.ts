import { create } from "zustand";

/**
 * Modo privacidade: esconde os valores em R$ na tela (cards, listas, gráficos, tooltips). É só visual e fica
 * guardado neste navegador (como o tema); relatórios exportados (PDF, TXT, CSV) e os campos de edição não mudam.
 */
export const PRIVACY_KEY = "aurora:privacy";
export const MASK = "R$ ••••";

function readStored(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === "1";
  } catch {
    return false;
  }
}

interface PrivacyState {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  hidden: readStored(),
  setHidden: (hidden) => {
    try {
      localStorage.setItem(PRIVACY_KEY, hidden ? "1" : "0");
    } catch {
      // sem persistência, vale só para a sessão
    }
    set({ hidden });
  },
  toggle: () => get().setHidden(!get().hidden),
}));

/** Lido por quem formata valor fora de componentes (formatBRL, eixos dos gráficos). */
export const isPrivate = () => usePrivacyStore.getState().hidden;
