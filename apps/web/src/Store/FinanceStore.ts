import { create } from "zustand";
import {
  getCreditByMonth,
  getHiddenTransactionsByMonth,
  getTransactionsByMonth,
  patchAmountForMonth,
  patchHideInMonth,
  patchRestoreInMonth,
  patchToggleFixed,
  type CreditInstallment,
  patchContribution,
  type CreditTransaction,
  type CustomCategory,
  type DistributionItem,
  type ExtraExpense,
  type Goal,
  type Note,
  type OnboardingState,
  type Transaction,
} from "../domain";
import { repository } from "../repositories";
import type { Category } from "../Types/Category";
import { getCurrentMonth } from "../Utils/Date";

export type { CreditInstallment, CreditTransaction, CustomCategory, DistributionItem, ExtraExpense, Goal, Note, Transaction };

/**
 * Estado do app. Os dados vêm do repositório (hoje o localStorage) e a store
 * guarda uma cópia para a tela. Regras de negócio ficam em `src/domain`,
 * aqui só se decide o que mudar e se avisa o repositório.
 * Valores em dinheiro são sempre CENTAVOS.
 */
interface FinanceState {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Esvazia a tela (ao sair da conta). */
  reset: () => void;

  currentMonth: string;
  setCurrentMonth: (month: string) => void;

  transactions: Transaction[];
  creditTransactions: CreditTransaction[];
  notes: Note[];
  goals: Goal[];
  extraExpenses: ExtraExpense[];
  customCategories: CustomCategory[];
  /** null = percentuais padrão */
  distribution: DistributionItem[] | null;
  /** chaves dos avisos de meta já vistos */
  seenAlerts: string[];
  /** resposta ao tour de cada tela */
  onboarding: Record<string, OnboardingState>;
  setOnboarding: (screen: string, state: OnboardingState) => void;

  addTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
  updateTransactionName: (id: string, name: string) => void;
  updateTransactionCategory: (id: string, category: Category) => void;
  updateTransactionNotes: (id: string, notes: string) => void;
  updateTransactionAmountForMonth: (id: string, month: string, cents: number) => void;
  toggleTransactionFixed: (id: string) => void;
  /** Fixa: oculta no mês. Comum: remove de vez. */
  removeTransactionByMonth: (id: string, month: string) => void;
  restoreTransactionByMonth: (id: string, month: string) => void;

  addCreditTransaction: (credit: CreditTransaction) => void;
  updateCreditTransaction: (id: string, patch: Partial<CreditTransaction>) => void;
  removeCreditTransaction: (id: string) => void;

  addNote: (note: Note) => void;
  removeNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  updateNote: (id: string, content: string) => void;

  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  /** Registra aporte e rendimento (centavos) na meta. */
  contributeToGoal: (id: string, cents: number, yieldCents?: number) => void;
  removeGoal: (id: string) => void;

  addCategory: (category: CustomCategory) => void;
  removeCategory: (id: string) => void;

  addExtraExpense: (extra: ExtraExpense) => void;
  updateExtraExpense: (id: string, patch: Partial<ExtraExpense>) => void;
  setDistribution: (items: DistributionItem[] | null) => void;
  markAlertsSeen: (keys: string[]) => void;
  markAlertUnseen: (key: string) => void;
  removeExtraExpense: (id: string) => void;

  getTransactionsByMonth: (month: string) => Transaction[];
  getHiddenTransactionsByMonth: (month: string) => Transaction[];
  getCreditTransactionsByMonth: (month: string) => CreditInstallment[];
  getNotesByMonth: (month: string) => Note[];
}

export const useFinanceStore = create<FinanceState>()((set, get) => {
  /** Avisa o repositório. Se falhar, recarrega para a tela não ficar diferente do salvo. */
  const sync = (operation: Promise<void>) => {
    operation.catch((error) => {
      console.error("Falha ao salvar, recarregando os dados", error);
      get().hydrate().catch((e) => console.error("Falha ao recarregar", e));
    });
  };

  const findTransaction = (id: string) =>
    get().transactions.find((t) => t.id === id);

  /** Aplica um patch na transação, na tela e no repositório. */
  const patchTransaction = (id: string, patch: Partial<Transaction>) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }));
    sync(repository.updateTransaction(id, patch));
  };

  return {
    hydrated: false,

    hydrate: async () => {
      const data = await repository.load();
      set({ ...data, hydrated: true });
    },

    reset: () =>
      set({
        hydrated: false,
        transactions: [],
        creditTransactions: [],
        notes: [],
        goals: [],
        extraExpenses: [],
        customCategories: [],
        distribution: null,
        seenAlerts: [],
        onboarding: {},
      }),

    currentMonth: getCurrentMonth(),
    setCurrentMonth: (month) => set({ currentMonth: month }),

    transactions: [],
    creditTransactions: [],
    notes: [],
    goals: [],
    extraExpenses: [],
    customCategories: [],
    distribution: null,
    seenAlerts: [],
    onboarding: {},

    setOnboarding: (screen, state) => {
      set((s) => ({ onboarding: { ...s.onboarding, [screen]: state } }));
      sync(repository.setOnboarding(screen, state));
    },

    addTransaction: (transaction) => {
      set((state) => ({ transactions: [...state.transactions, transaction] }));
      sync(repository.addTransaction(transaction));
    },

    removeTransaction: (id) => {
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
      }));
      sync(repository.removeTransaction(id));
    },

    updateTransactionName: (id, name) => patchTransaction(id, { name }),

    updateTransactionCategory: (id, category) => patchTransaction(id, { category }),

    updateTransactionNotes: (id, notes) => patchTransaction(id, { notes }),

    updateTransactionAmountForMonth: (id, month, cents) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchAmountForMonth(t, month, cents));
    },

    toggleTransactionFixed: (id) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchToggleFixed(t));
    },

    removeTransactionByMonth: (id, month) => {
      const t = findTransaction(id);
      if (!t) return;

      const patch = patchHideInMonth(t, month);
      if (patch) patchTransaction(id, patch);
      else get().removeTransaction(id);
    },

    restoreTransactionByMonth: (id, month) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchRestoreInMonth(t, month));
    },

    addCreditTransaction: (credit) => {
      set((state) => ({
        creditTransactions: [...state.creditTransactions, credit],
      }));
      sync(repository.addCredit(credit));
    },

    updateCreditTransaction: (id, patch) => {
      set((state) => ({
        creditTransactions: state.creditTransactions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      sync(repository.updateCredit(id, patch));
    },

    removeCreditTransaction: (id) => {
      set((state) => ({
        creditTransactions: state.creditTransactions.filter((c) => c.id !== id),
      }));
      sync(repository.removeCredit(id));
    },

    addNote: (note) => {
      set((state) => ({ notes: [...state.notes, note] }));
      sync(repository.addNote(note));
    },

    removeNote: (id) => {
      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      sync(repository.removeNote(id));
    },

    togglePinNote: (id) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note) return;
      const patch = { pinned: !note.pinned };
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      }));
      sync(repository.updateNote(id, patch));
    },

    updateNote: (id, content) => {
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, content } : n)),
      }));
      sync(repository.updateNote(id, { content }));
    },

    addGoal: (goal) => {
      set((state) => ({ goals: [...state.goals, goal] }));
      sync(repository.addGoal(goal));
    },

    updateGoal: (id, patch) => {
      set((state) => ({ goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
      sync(repository.updateGoal(id, patch));
    },

    contributeToGoal: (id, cents, yieldCents = 0) => {
      const goal = get().goals.find((g) => g.id === id);
      if (goal) get().updateGoal(id, patchContribution(goal, cents, yieldCents));
    },

    removeGoal: (id) => {
      const seenAlerts = get().seenAlerts.filter((k) => !k.startsWith(`${id}:`));
      set((state) => ({ goals: state.goals.filter((g) => g.id !== id), seenAlerts }));
      sync(repository.removeGoal(id));
      sync(repository.setSeenAlerts(seenAlerts));
    },

    addCategory: (category) => {
      set((state) => ({ customCategories: [...state.customCategories, category] }));
      sync(repository.addCategory(category));
    },

    removeCategory: (id) => {
      set((state) => ({ customCategories: state.customCategories.filter((c) => c.id !== id) }));
      sync(repository.removeCategory(id));
    },

    addExtraExpense: (extra) => {
      set((state) => ({ extraExpenses: [...state.extraExpenses, extra] }));
      sync(repository.addExtraExpense(extra));
    },

    updateExtraExpense: (id, patch) => {
      set((state) => ({
        extraExpenses: state.extraExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
      sync(repository.updateExtraExpense(id, patch));
    },

    markAlertsSeen: (keys) => {
      const next = [...new Set([...get().seenAlerts, ...keys])];
      set({ seenAlerts: next });
      sync(repository.setSeenAlerts(next));
    },

    markAlertUnseen: (key) => {
      const next = get().seenAlerts.filter((k) => k !== key);
      set({ seenAlerts: next });
      sync(repository.setSeenAlerts(next));
    },

    setDistribution: (items) => {
      set({ distribution: items });
      sync(repository.setDistribution(items));
    },

    removeExtraExpense: (id) => {
      set((state) => ({ extraExpenses: state.extraExpenses.filter((e) => e.id !== id) }));
      sync(repository.removeExtraExpense(id));
    },

    getTransactionsByMonth: (month) =>
      getTransactionsByMonth(get().transactions, month),

    getHiddenTransactionsByMonth: (month) =>
      getHiddenTransactionsByMonth(get().transactions, month),

    getCreditTransactionsByMonth: (month) =>
      getCreditByMonth(get().creditTransactions, month),

    getNotesByMonth: (month) => get().notes.filter((n) => n.month === month),
  };
});
