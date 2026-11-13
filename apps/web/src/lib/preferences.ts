import { create } from "zustand";
import { DEFAULT_DUE_WINDOW, DUE_WINDOWS } from "@/domain/dues";
import { isScenario, type Scenario } from "@/domain/scenarios";
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
  /** ids dos insights do Painel que o usuário dispensou */
  dismissedInsights: string[];
  /** janela do card "Próximos vencimentos", em dias (7, 14 ou 30) */
  dueWindow: number;
  /** cenário da Projeção para a renda variável: conservador (padrão, só renda fixa), médio ou otimista */
  scenario: Scenario;
  /** avisos do sino que o usuário limpou (some da lista "Já vistos"; volta só se o aviso mudar de nível) */
  clearedAlerts: string[];
  /** seções de Lançamentos que o usuário fechou (as outras ficam abertas) */
  collapsedSections: string[];
}

/** Quantos insights dispensados ficam guardados (os mais antigos saem primeiro). */
export const MAX_DISMISSED = 200;
/** Quantos avisos limpos ficam guardados (os mais antigos saem primeiro). */
export const MAX_CLEARED = 500;
/** Quantas seções fechadas ficam guardadas. */
export const MAX_COLLAPSED = 50;

export const DEFAULT_PREFS: Preferences = { showHours: false, hoursPerMonth: DEFAULT_HOURS_PER_MONTH, netIncome: null, showBreathing: false, dismissedInsights: [], dueWindow: DEFAULT_DUE_WINDOW, scenario: "conservative", clearedAlerts: [], collapsedSections: [] };

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
      clearedAlerts: Array.isArray(d.clearedAlerts) ? d.clearedAlerts.filter((x): x is string => typeof x === "string").slice(-MAX_CLEARED) : [],
      collapsedSections: Array.isArray(d.collapsedSections) ? d.collapsedSections.filter((x): x is string => typeof x === "string").slice(-MAX_COLLAPSED) : [],
      scenario: isScenario(d.scenario) ? d.scenario : "conservative",
      dueWindow: (DUE_WINDOWS as readonly number[]).includes(d.dueWindow as number) ? (d.dueWindow as number) : DEFAULT_DUE_WINDOW,
      dismissedInsights: Array.isArray(d.dismissedInsights) ? d.dismissedInsights.filter((x): x is string => typeof x === "string").slice(-MAX_DISMISSED) : [],
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
    const { showHours, hoursPerMonth, netIncome, showBreathing, dismissedInsights, dueWindow, scenario, clearedAlerts, collapsedSections } = get();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ showHours, hoursPerMonth, netIncome, showBreathing, dismissedInsights, dueWindow, scenario, clearedAlerts, collapsedSections }));
    } catch {
      // sem persistência, vale só para a sessão
    }
  },
}));

/** Dispensa um insight (some do Painel; volta só se a situação mudar e gerar outro id). */
export function dismissInsight(id: string) {
  const { dismissedInsights, setPrefs } = usePrefsStore.getState();
  if (dismissedInsights.includes(id)) return;
  setPrefs({ dismissedInsights: [...dismissedInsights, id].slice(-MAX_DISMISSED) });
}

/** Limpa avisos do sino: guarda as chaves deles como "limpos". */
export function clearAlerts(keys: string[]) {
  const { clearedAlerts, setPrefs } = usePrefsStore.getState();
  setPrefs({ clearedAlerts: [...new Set([...clearedAlerts, ...keys])].slice(-MAX_CLEARED) });
}

/** Abre ou fecha uma seção de Lançamentos; a escolha fica guardada neste navegador. */
export function toggleSection(id: string) {
  const { collapsedSections, setPrefs } = usePrefsStore.getState();
  setPrefs({ collapsedSections: collapsedSections.includes(id) ? collapsedSections.filter((x) => x !== id) : [...collapsedSections, id].slice(-MAX_COLLAPSED) });
}
