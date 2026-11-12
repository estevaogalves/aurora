import type {
  CreditCard,
  CreditTransaction,
  CustomCategory,
  DistributionItem,
  ExtraExpense,
  FinanceData,
  Goal,
  Investment,
  InvestmentMovement,
  Note,
  OnboardingState,
  InvoiceAdjustment,
  Payment,
  Transaction,
} from "../domain/types";
import { patchCardAdjustments, patchCardPayment } from "../domain/invoice";
import { patchClearPayment, patchSetPayment } from "../domain/payment";
import { patchAdvanceInstallment, patchClearActualValue,
  patchEditInstallment, patchRemoveInstallment, type PatchResult } from "../domain/credit";
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

  async replaceAll(data: FinanceData) {
    this.data = data;
    this.persist();
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

  async addCreditCard(card: CreditCard) {
    this.data.creditCards = [...(this.data.creditCards ?? []), card];
    this.persist();
  }

  async updateCreditCard(id: string, patch: Partial<CreditCard>) {
    this.data.creditCards = (this.data.creditCards ?? []).map((k) => (k.id === id ? { ...k, ...patch } : k));
    this.persist();
  }

  async removeCreditCard(id: string) {
    this.data.creditCards = (this.data.creditCards ?? []).filter((k) => k.id !== id);
    this.data.creditTransactions = this.data.creditTransactions.map((c) => (c.cardId === id ? { ...c, cardId: undefined } : c));
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

  async clearInstallmentValue(id: string, n: number) {
    this.adjustCredit(id, (c) => patchClearActualValue(c, n));
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

  async setCardPayment(id: string, month: string, payment: Payment | null) {
    this.data.creditCards = (this.data.creditCards ?? []).map((k) => (k.id === id ? { ...k, ...patchCardPayment(k, month, payment) } : k));
    this.persist();
  }

  async setCardAdjustments(id: string, month: string, adjustments: InvoiceAdjustment[]) {
    this.data.creditCards = (this.data.creditCards ?? []).map((k) => (k.id === id ? { ...k, ...patchCardAdjustments(k, month, adjustments) } : k));
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

  async addInvestment(investment: Investment) {
    this.data.investments = [...(this.data.investments ?? []), investment];
    this.persist();
  }

  async updateInvestment(id: string, patch: Partial<Investment>) {
    this.data.investments = (this.data.investments ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i));
    this.persist();
  }

  async removeInvestment(id: string) {
    this.data.investments = (this.data.investments ?? []).filter((i) => i.id !== id);
    this.data.investmentMovements = (this.data.investmentMovements ?? []).filter((m) => m.investmentId !== id);
    this.persist();
  }

  async addInvestmentMovement(movement: InvestmentMovement) {
    this.data.investmentMovements = [...(this.data.investmentMovements ?? []), movement];
    this.persist();
  }

  async updateInvestmentMovement(id: string, patch: Partial<InvestmentMovement>) {
    this.data.investmentMovements = (this.data.investmentMovements ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    this.persist();
  }

  async removeInvestmentMovement(id: string) {
    this.data.investmentMovements = (this.data.investmentMovements ?? []).filter((m) => m.id !== id);
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
      creditCards: this.data.creditCards ?? [],
      notes: this.data.notes,
      goals: this.data.goals,
      investments: this.data.investments ?? [],
      investmentMovements: this.data.investmentMovements ?? [],
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
