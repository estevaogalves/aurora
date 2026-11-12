/**
 * Preferências do bloco "Exportar relatório": o formato e o que vem marcado. Guardadas no navegador
 * (localStorage), então valem para esta máquina e este navegador, no modo local e no modo com API.
 * Qualquer problema (sem permissão, texto corrompido, chave faltando) volta ao padrão sem quebrar a tela.
 */

export type ReportFormat = "PDF" | "CSV" | "TXT";

export interface ReportContent {
  summary: boolean;
  entries: boolean;
  invoices: boolean;
  distribution: boolean;
}

export interface ReportPrefs {
  format: ReportFormat;
  content: ReportContent;
}

export const REPORT_PREFS_KEY = "aurora:report-prefs";

export const DEFAULT_REPORT_PREFS: ReportPrefs = {
  format: "PDF",
  content: { summary: true, entries: true, invoices: true, distribution: false },
};

const FORMATS: ReportFormat[] = ["PDF", "CSV", "TXT"];
const CONTENT_KEYS = Object.keys(DEFAULT_REPORT_PREFS.content) as (keyof ReportContent)[];

/** Só aceita o que reconhece; o resto fica no padrão. */
export function parseReportPrefs(raw: string | null | undefined): ReportPrefs {
  const base: ReportPrefs = { format: DEFAULT_REPORT_PREFS.format, content: { ...DEFAULT_REPORT_PREFS.content } };
  if (!raw) return base;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return base;
    const p = parsed as { format?: unknown; content?: unknown };
    if (typeof p.format === "string" && (FORMATS as string[]).includes(p.format)) base.format = p.format as ReportFormat;
    if (typeof p.content === "object" && p.content !== null) {
      for (const key of CONTENT_KEYS) {
        const value = (p.content as Record<string, unknown>)[key];
        if (typeof value === "boolean") base.content[key] = value;
      }
    }
    return base;
  } catch {
    return base;
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // acesso negado (modo privado, dados de site bloqueados)
  }
}

export function loadReportPrefs(storage: StorageLike | null = browserStorage()): ReportPrefs {
  try {
    return parseReportPrefs(storage?.getItem(REPORT_PREFS_KEY));
  } catch {
    return parseReportPrefs(null);
  }
}

/** Devolve false se não deu para guardar (o navegador negou). */
export function saveReportPrefs(prefs: ReportPrefs, storage: StorageLike | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(REPORT_PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export const sameReportPrefs = (a: ReportPrefs, b: ReportPrefs) => a.format === b.format && CONTENT_KEYS.every((k) => a.content[k] === b.content[k]);
