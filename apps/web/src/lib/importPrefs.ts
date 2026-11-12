import { create } from "zustand";
import type { CategoryRule, ColumnMapping } from "@/domain/csvImport";

/**
 * Preferências da importação de CSV, guardadas só neste navegador (como o tema): o mapeamento de colunas de cada banco,
 * as regras de categoria e as chaves das linhas já importadas (para reimportar o mesmo arquivo não duplicar).
 * O arquivo em si nunca é guardado.
 */
export const IMPORT_KEY = "aurora:import";
export const MAX_SAVED_MAPPINGS = 20;
export const MAX_RULES = 100;
export const MAX_IMPORTED_KEYS = 5000;

export interface SavedMapping {
  /** nome que o usuário deu (ex.: "Nubank fatura") */
  name: string;
  /** assinatura do arquivo: o cabeçalho (sem acento) ou o número de colunas; serve para reaplicar sozinho */
  signature: string;
  mapping: ColumnMapping;
}

interface Stored {
  mappings: SavedMapping[];
  rules: CategoryRule[];
  imported: string[];
}

const EMPTY: Stored = { mappings: [], rules: [], imported: [] };

const isMapping = (m: unknown): m is ColumnMapping => {
  const x = m as ColumnMapping;
  return !!x && [x.date, x.description, x.amount].every((n) => Number.isInteger(n) && n >= 0 && n < 200) && typeof x.hasHeader === "boolean" && ["auto", "expense", "income"].includes(x.signMode);
};

/** Lê o que foi salvo, aceitando só o formato certo. */
export function parseImportPrefs(raw: string | null): Stored {
  if (!raw) return EMPTY;
  try {
    const d = JSON.parse(raw) as Partial<Stored>;
    return {
      mappings: (Array.isArray(d.mappings) ? d.mappings : []).filter((m): m is SavedMapping => !!m && typeof m.name === "string" && typeof m.signature === "string" && isMapping(m.mapping)).slice(0, MAX_SAVED_MAPPINGS),
      rules: (Array.isArray(d.rules) ? d.rules : []).filter((r): r is CategoryRule => !!r && typeof r.id === "string" && typeof r.contains === "string" && typeof r.category === "string").slice(0, MAX_RULES),
      imported: (Array.isArray(d.imported) ? d.imported : []).filter((k): k is string => typeof k === "string").slice(-MAX_IMPORTED_KEYS),
    };
  } catch {
    return EMPTY;
  }
}

function read(): Stored {
  try {
    return parseImportPrefs(localStorage.getItem(IMPORT_KEY));
  } catch {
    return EMPTY;
  }
}

interface ImportPrefsState extends Stored {
  saveMapping: (m: SavedMapping) => void;
  addRule: (rule: CategoryRule) => void;
  removeRule: (id: string) => void;
  addImported: (keys: string[]) => void;
}

export const useImportPrefs = create<ImportPrefsState>((set, get) => {
  const persist = () => {
    const { mappings, rules, imported } = get();
    try {
      localStorage.setItem(IMPORT_KEY, JSON.stringify({ mappings, rules, imported }));
    } catch {
      // sem persistência, vale só para a sessão
    }
  };
  return {
    ...read(),
    saveMapping: (m) => {
      set((s) => ({ mappings: [m, ...s.mappings.filter((x) => x.name !== m.name)].slice(0, MAX_SAVED_MAPPINGS) }));
      persist();
    },
    addRule: (rule) => {
      set((s) => ({ rules: [...s.rules, rule].slice(0, MAX_RULES) }));
      persist();
    },
    removeRule: (id) => {
      set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
      persist();
    },
    addImported: (keys) => {
      set((s) => ({ imported: [...new Set([...s.imported, ...keys])].slice(-MAX_IMPORTED_KEYS) }));
      persist();
    },
  };
});
