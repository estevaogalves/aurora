import { DATA_SOURCE } from "../config";
import { ApiRepository } from "./ApiRepository";
import type { FinanceRepository } from "./FinanceRepository";
import { LocalRepository } from "./LocalRepository";

/** Fonte de dados do app, escolhida por `VITE_DATA_SOURCE` (local ou api). */
export const repository: FinanceRepository = DATA_SOURCE === "api" ? new ApiRepository() : new LocalRepository();

export type { FinanceRepository } from "./FinanceRepository";
