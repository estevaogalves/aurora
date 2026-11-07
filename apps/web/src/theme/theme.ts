import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_KEY = "aurora:theme";
export const APP_NAME = "Aurora";
export const APP_TAGLINE = "Controle Financeiro";

function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage indisponível: segue com o padrão
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // sem persistência, a troca vale só para a sessão
    }
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Aplica o tema salvo; chamar antes de desenhar a tela. */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
}
