import type {
  CreditTransaction,
  CustomCategory,
  DistributionItem,
  ExtraExpense,
  FinanceData,
  Goal,
  Note,
  OnboardingState,
  Transaction,
} from "../domain/types";

/**
 * De onde vêm e para onde vão os dados.
 * Hoje: LocalRepository (localStorage). Depois: ApiRepository (backend Go).
 * A store só conhece esta interface.
 */
export interface FinanceRepository {
  load(): Promise<FinanceData>;

  addTransaction(transaction: Transaction): Promise<void>;
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<void>;
  removeTransaction(id: string): Promise<void>;

  addCredit(credit: CreditTransaction): Promise<void>;
  updateCredit(id: string, patch: Partial<CreditTransaction>): Promise<void>;
  removeCredit(id: string): Promise<void>;
  /** Adianta a última parcela (futura): cobra o valor com desconto no mês atual. Desconto em centavos. */
  advanceInstallment(id: string, n: number, discount: number): Promise<void>;
  /** Muda só o valor (centavos) de uma parcela. */
  editInstallment(id: string, n: number, cents: number): Promise<void>;
  /** Exclui só uma parcela. */
  removeInstallment(id: string, n: number): Promise<void>;

  addNote(note: Note): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  removeNote(id: string): Promise<void>;

  addGoal(goal: Goal): Promise<void>;
  updateGoal(id: string, patch: Partial<Goal>): Promise<void>;
  removeGoal(id: string): Promise<void>;

  addExtraExpense(extra: ExtraExpense): Promise<void>;
  updateExtraExpense(id: string, patch: Partial<ExtraExpense>): Promise<void>;
  removeExtraExpense(id: string): Promise<void>;

  addCategory(category: CustomCategory): Promise<void>;
  removeCategory(id: string): Promise<void>;

  /** null volta ao padrão */
  setDistribution(items: DistributionItem[] | null): Promise<void>;

  /** Lista completa dos avisos de meta marcados como vistos. */
  setSeenAlerts(keys: string[]): Promise<void>;

  /** Grava a resposta ao tour de uma tela, sem mexer nas outras. */
  setOnboarding(screen: string, state: OnboardingState): Promise<void>;
}
