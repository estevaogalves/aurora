import type { FinanceRepository } from "./FinanceRepository";
import { LocalRepository } from "./LocalRepository";

/**
 * Fonte de dados do app. Hoje é local; na integração com a API
 * esta é a única linha que escolhe entre Local e Api.
 */
export const repository: FinanceRepository = new LocalRepository();

export type { FinanceRepository } from "./FinanceRepository";
