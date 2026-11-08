import type {
  CreditTransaction,
  CustomCategory,
  DistributionItem,
  ExtraExpense,
  FinanceData,
  Goal,
  Note,
  OnboardingState,
  Payment,
  Transaction,
} from "../domain/types";
import { patchClearPayment, patchSetPayment } from "../domain/payment";
import { patchAdvanceInstallment, patchEditInstallment, patchRemoveInstallment, type PatchResult } from "../domain/credit";
import { getCurrentMonth } from "../Utils/Date";
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

  /** Aplica o patch de uma regra de domínio na compra (a API faz o mesmo no servidor). */
  private adjustCredit(id: string, rule: (credit: CreditTransaction) => PatchResult) {
    const credit = this.data.creditTransactions.find((c) => c.id === id);
    if (!credit) return;
    const result = rule(credit);
    if (!result.ok) throw new Error(result.error);
    this.data.creditTransactions = this.data.creditTransactions.map((c) => (c.id === id ? { ...c, ...result.patch } : c));
    this.persist();
  }

  async advanceInstallment(id: string, n: number, discount: number) {
    this.adjustCredit(id, (c) => patchAdvanceInstallment(c, n, discount, getCurrentMonth()));
  }

  async editInstallment(id: string, n: number, cents: number) {
    this.adjustCredit(id, (c) => patchEditInstallment(c, n, cents));
  }

  async removeInstallment(id: string, n: number) {
    this.adjustCredit(id, (c) => patchRemoveInstallment(c, n));
  }

  async setTransactionPayment(id: string, month: string, payment: Payment | null) {
    this.data.transactions = this.data.transactions.map((t) =>
      t.id === id ? { ...t, ...(payment ? patchSetPayment(t, month, payment) : patchClearPayment(t, month)) } : t,
    );
    this.persist();
  }

  async setExtraPayment(id: string, payment: Payment | null) {
    this.data.extraExpenses = this.data.extraExpenses.map((e) => (e.id === id ? { ...e, payment: payment ?? undefined } : e));
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

  async updateExtraExpense(id: string, patch: Partial<ExtraExpense>) {
    this.data.extraExpenses = this.data.extraExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
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

  async setDistribution(items: DistributionItem[] | null) {
    this.data.distribution = items;
    this.persist();
  }

  async setSeenAlerts(keys: string[]) {
    this.data.seenAlerts = keys;
    this.persist();
  }

  async setOnboarding(screen: string, state: OnboardingState) {
    this.data.onboarding = { ...this.data.onboarding, [screen]: state };
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
      distribution: this.data.distribution,
      seenAlerts: this.data.seenAlerts,
      onboarding: this.data.onboarding,
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
