import type {
  CreditTransaction,
  CustomCategory,
  ExtraExpense,
  FinanceData,
  Goal,
  Note,
  Transaction,
} from "../domain/types";
import type { FinanceRepository } from "./FinanceRepository";
import {
  CURRENT_VERSION,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  emptyData,
  migrateLegacy,
  migrateStored,
  parseJson,
  type StoredEnvelope,
} from "./localMigration";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Guarda tudo no localStorage, num único envelope versionado. */
export class LocalRepository implements FinanceRepository {
  private data: FinanceData = emptyData();
  private readonly storage: StorageLike | null;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? safeLocalStorage();
  }

  async load(): Promise<FinanceData> {
    const current = migrateStored(parseJson(this.read(STORAGE_KEY)));

    if (current) {
      this.data = current;
      return this.snapshot();
    }

    // primeiro acesso nesta versão: traz os dados do formato antigo, se houver
    const legacy = migrateLegacy(parseJson(this.read(LEGACY_STORAGE_KEY)));
    this.data = legacy ?? emptyData();
    if (legacy) this.persist();

    return this.snapshot();
  }

  async addTransaction(transaction: Transaction) {
    this.data.transactions = [...this.data.transactions, transaction];
    this.persist();
  }

  async updateTransaction(id: string, patch: Partial<Transaction>) {
    this.data.transactions = this.data.transactions.map((t) =>
      t.id === id ? { ...t, ...patch } : t,
    );
    this.persist();
  }

  async removeTransaction(id: string) {
    this.data.transactions = this.data.transactions.filter((t) => t.id !== id);
    this.persist();
  }

  async addCredit(credit: CreditTransaction) {
    this.data.creditTransactions = [...this.data.creditTransactions, credit];
    this.persist();
  }

  async updateCredit(id: string, patch: Partial<CreditTransaction>) {
    this.data.creditTransactions = this.data.creditTransactions.map((c) =>
      c.id === id ? { ...c, ...patch } : c,
    );
    this.persist();
  }

  async removeCredit(id: string) {
    this.data.creditTransactions = this.data.creditTransactions.filter(
      (c) => c.id !== id,
    );
    this.persist();
  }

  async addNote(note: Note) {
    this.data.notes = [...this.data.notes, note];
    this.persist();
  }

  async updateNote(id: string, patch: Partial<Note>) {
    this.data.notes = this.data.notes.map((n) =>
      n.id === id ? { ...n, ...patch } : n,
    );
    this.persist();
  }

  async removeNote(id: string) {
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this.persist();
  }

  async addGoal(goal: Goal) {
    this.data.goals = [...this.data.goals, goal];
    this.persist();
  }

  async updateGoal(id: string, patch: Partial<Goal>) {
    this.data.goals = this.data.goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
    this.persist();
  }

  async removeGoal(id: string) {
    this.data.goals = this.data.goals.filter((g) => g.id !== id);
    this.persist();
  }

  async addExtraExpense(extra: ExtraExpense) {
    this.data.extraExpenses = [...this.data.extraExpenses, extra];
    this.persist();
  }

  async removeExtraExpense(id: string) {
    this.data.extraExpenses = this.data.extraExpenses.filter((e) => e.id !== id);
    this.persist();
  }

  async addCategory(category: CustomCategory) {
    this.data.customCategories = [...this.data.customCategories, category];
    this.persist();
  }

  async removeCategory(id: string) {
    this.data.customCategories = this.data.customCategories.filter((c) => c.id !== id);
    this.persist();
  }

  /* ---------- internos ---------- */

  private snapshot(): FinanceData {
    return {
      transactions: this.data.transactions,
      creditTransactions: this.data.creditTransactions,
      notes: this.data.notes,
      goals: this.data.goals,
      extraExpenses: this.data.extraExpenses,
      customCategories: this.data.customCategories,
    };
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private persist() {
    const envelope: StoredEnvelope = {
      version: CURRENT_VERSION,
      data: this.data,
    };
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // armazenamento cheio ou bloqueado: o app segue só em memória
    }
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
