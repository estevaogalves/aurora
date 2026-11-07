import type {
  CreditTransaction,
  FinanceData,
  Note,
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
  removeCredit(id: string): Promise<void>;

  addNote(note: Note): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  removeNote(id: string): Promise<void>;
}
