import { create } from "zustand";
import { DEFAULT_HOURS_PER_MONTH } from "@/domain/workTime";

/**
 * Preferências de visualização, guardadas só neste navegador (como o tema). Nada aqui vai para o banco nem muda
 * valores: são ajustes de como a tela mostra o que já existe.
 */
export const PREFS_KEY = "aurora:prefs";

export interface Preferences {
  /** mostra "≈ X h de trabalho" ao lado das despesas (desligado por padrão) */
  showHours: boolean;
  /** horas trabalhadas por mês */
  hoursPerMonth: number;
  /** renda líquida base em centavos; null = usa a renda do mês visto */
  netIncome: number | null;
  /** card "Dias de fôlego" no Painel (desligado por padrão) */
  showBreathing: boolean;
}

export const DEFAULT_PREFS: Preferences = { showHours: false, hoursPerMonth: DEFAULT_HOURS_PER_MONTH, netIncome: null, showBreathing: false };

/** Lê o que foi salvo, aceitando só campos do tipo certo (o resto volta ao padrão). */
export function parsePrefs(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFS;
  try {
    const d = JSON.parse(raw) as Partial<Preferences>;
    return {
      showHours: d.showHours === true,
      hoursPerMonth: typeof d.hoursPerMonth === "number" && d.hoursPerMonth > 0 && d.hoursPerMonth <= 744 ? d.hoursPerMonth : DEFAULT_PREFS.hoursPerMonth,
      netIncome: typeof d.netIncome === "number" && d.netIncome > 0 ? d.netIncome : null,
      showBreathing: d.showBreathing === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function read(): Preferences {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

interface PrefsState extends Preferences {
  setPrefs: (patch: Partial<Preferences>) => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...read(),
  setPrefs: (patch) => {
    set(patch);
    const { showHours, hoursPerMonth, netIncome, showBreathing } = get();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ showHours, hoursPerMonth, netIncome, showBreathing }));
    } catch {
      // sem persistência, vale só para a sessão
    }
  },
}));
