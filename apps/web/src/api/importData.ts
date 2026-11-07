import type { FinanceData } from "../domain/types";
import { api } from "./http";
import { normalizeFinanceData } from "../repositories/ApiRepository";

/** Envia os dados do localStorage. Sem `replace`, a API recusa (409) se a conta já tem dados. */
export async function importLocalData(data: FinanceData, replace = false): Promise<FinanceData> {
  const saved = await api.post<Partial<FinanceData>>(`/import${replace ? "?replace=true" : ""}`, data);
  return normalizeFinanceData(saved);
}
