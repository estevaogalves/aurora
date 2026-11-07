import type { FinanceData } from "@/domain/types";
import { LocalRepository } from "@/repositories/LocalRepository";

const DISMISSED_KEY = "aurora:import-dismissed";

/** Quantos registros existem em cada lista. */
export function countRecords(d: FinanceData) {
  return {
    transactions: d.transactions.length,
    credits: d.creditTransactions.length,
    goals: d.goals.length,
    extras: d.extraExpenses.length,
    notes: d.notes.length,
    categories: d.customCategories.length,
  };
}

export const hasLocalRecords = (d: FinanceData) => Object.values(countRecords(d)).some((n) => n > 0);

/** Lê o que ficou salvo neste navegador (sem alterar nada). */
export const readLocalData = () => new LocalRepository().load();

export function importDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissImport() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // sem localStorage: o aviso volta na próxima visita
  }
}
