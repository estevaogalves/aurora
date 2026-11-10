import { create } from "zustand";
import {
  getCreditByMonth,
  resolveCredits,
  patchAdvanceInstallment,
  patchCancelRecurrence,
  patchClearActualValue,
  patchEditInstallment,
  patchRemoveInstallment,
  type PatchResult,
  getHiddenTransactionsByMonth,
  getTransactionsByMonth,
  patchAmountForMonth,
  patchNotesForMonth,
  patchAmountFromMonth,
  patchHideInMonth,
  patchRestoreInMonth,
  patchToggleFixed,
  patchClearMonthValue,
  type CreditInstallment,
  patchContribution,
  type CreditCard,
  type CreditTransaction,
  type FinanceData,
  type CustomCategory,
  type DistributionItem,
  type ExtraExpense,
  type Goal,
  type Note,
  type OnboardingState,
  type Payment,
  type Transaction,
  patchClearPayment,
  patchSetPayment,
} from "../domain";
import { repository } from "../repositories";
import type { Category } from "../Types/Category";
import { changeMonth, getCurrentMonth, monthsDifference } from "../Utils/Date";

export type { CreditCard, CreditInstallment, CreditTransaction, CustomCategory, DistributionItem, ExtraExpense, Goal, Note, Transaction };

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
  /** Restaura um backup: troca todos os dados pelos informados. */
  replaceAll: (data: FinanceData) => Promise<void>;

  currentMonth: string;
  setCurrentMonth: (month: string) => void;

  transactions: Transaction[];
  creditTransactions: CreditTransaction[];
  creditCards: CreditCard[];
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
  /** Observação só do mês visto (fixa não repete nos outros meses). */
  updateTransactionNotes: (id: string, month: string, notes: string) => void;
  updateTransactionAmountForMonth: (id: string, month: string, cents: number) => void;
  /** Fixa: o novo valor vale deste mês em diante (os anteriores não mudam). */
  updateTransactionAmountFromMonth: (id: string, month: string, cents: number) => void;
  toggleTransactionFixed: (id: string) => void;
  /** Fixa: liga ou desliga o valor variável (estimado). */
  setTransactionVariable: (id: string, variable: boolean) => void;
  /** Fixa variável: tira o valor real do mês e volta ao estimado. */
  clearTransactionActualValue: (id: string, month: string) => void;
  /** Fixa: oculta no mês. Comum: remove de vez. */
  removeTransactionByMonth: (id: string, month: string) => void;
  restoreTransactionByMonth: (id: string, month: string) => void;

  addCreditTransaction: (credit: CreditTransaction) => void;
  updateCreditTransaction: (id: string, patch: Partial<CreditTransaction>) => void;
  addCreditCard: (card: CreditCard) => void;
  updateCreditCard: (id: string, patch: Partial<CreditCard>) => void;
  removeCreditCard: (id: string) => void;
  removeCreditTransaction: (id: string) => void;
  /** Volta um mês de recorrência variável para o valor estimado. Devolve a mensagem de erro, se houver. */
  clearCreditActualValue: (id: string, n: number) => string | null;
  /** Adianta a última parcela (futura) com desconto em centavos. Devolve a mensagem de erro, ou null se deu certo. */
  advanceCreditInstallment: (id: string, n: number, discount: number) => string | null;
  /** Muda só o valor (centavos) de uma parcela. Devolve a mensagem de erro, ou null. */
  updateCreditInstallment: (id: string, n: number, cents: number) => string | null;
  /** Exclui só uma parcela. Devolve a mensagem de erro, ou null. */
  removeCreditInstallment: (id: string, n: number) => string | null;
  /** Cancela a recorrência: `last` é o último mês cobrado (nunca antes do mês atual). Devolve a mensagem de erro, ou null. */
  cancelCreditRecurrence: (id: string, last: string) => string | null;

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
  /** Marca (ou troca) o pagamento de uma despesa em um mês; null desmarca. Só registro: não muda nenhum valor. */
  setTransactionPayment: (id: string, month: string, payment: Payment | null) => void;
  /** Marca (ou troca) o pagamento de uma despesa extra; null desmarca. */
  setExtraPayment: (id: string, payment: Payment | null) => void;

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

  /** Aplica na tela a regra de uma parcela e avisa o repositório; o servidor valida de novo. */
  const adjustCredit = (id: string, rule: (c: CreditTransaction) => PatchResult, save: () => Promise<void>): string | null => {
    const credit = get().creditTransactions.find((c) => c.id === id);
    if (!credit) return "Compra não encontrada.";
    const result = rule(credit);
    if (!result.ok) return result.error;
    set((state) => ({
      creditTransactions: state.creditTransactions.map((c) => (c.id === id ? { ...c, ...result.patch } : c)),
    }));
    sync(save());
    return null;
  };

  return {
    hydrated: false,

    replaceAll: async (data) => {
      await repository.replaceAll(data);
      await get().hydrate();
    },

    hydrate: async () => {
      const data = await repository.load();
      set({ ...data, hydrated: true });
    },

    reset: () =>
      set({
        hydrated: false,
        transactions: [],
        creditTransactions: [],
        creditCards: [],
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
    creditCards: [],
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

    updateTransactionNotes: (id, month, notes) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchNotesForMonth(t, month, notes));
    },

    updateTransactionAmountForMonth: (id, month, cents) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchAmountForMonth(t, month, cents));
    },

    updateTransactionAmountFromMonth: (id, month, cents) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchAmountFromMonth(t, month, cents));
    },

    toggleTransactionFixed: (id) => {
      const t = findTransaction(id);
      if (t) patchTransaction(id, patchToggleFixed(t));
    },

    setTransactionVariable: (id, variable) => {
      const t = findTransaction(id);
      if (t?.fixed) patchTransaction(id, { variableAmount: variable });
    },

    clearTransactionActualValue: (id, month) => {
      const t = findTransaction(id);
      const patch = t && patchClearMonthValue(t, month);
      if (patch) patchTransaction(id, patch);
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

    addCreditCard: (card) => {
      set((state) => ({ creditCards: [...state.creditCards, card] }));
      sync(repository.addCreditCard(card));
    },

    updateCreditCard: (id, patch) => {
      set((state) => ({ creditCards: state.creditCards.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
      sync(repository.updateCreditCard(id, patch));
    },

    removeCreditCard: (id) => {
      set((state) => ({
        creditCards: state.creditCards.filter((k) => k.id !== id),
        creditTransactions: state.creditTransactions.map((c) => (c.cardId === id ? { ...c, cardId: undefined } : c)),
      }));
      sync(repository.removeCreditCard(id));
    },

    removeCreditTransaction: (id) => {
      set((state) => ({
        creditTransactions: state.creditTransactions.filter((c) => c.id !== id),
      }));
      sync(repository.removeCredit(id));
    },

    advanceCreditInstallment: (id, n, discount) =>
      adjustCredit(id, (c) => patchAdvanceInstallment(c, n, discount, getCurrentMonth()), () => repository.advanceInstallment(id, n, discount)),

    updateCreditInstallment: (id, n, cents) =>
      adjustCredit(id, (c) => patchEditInstallment(c, n, cents), () => repository.editInstallment(id, n, cents)),

    removeCreditInstallment: (id, n) =>
      adjustCredit(id, (c) => patchRemoveInstallment(c, n), () => repository.removeInstallment(id, n)),

    clearCreditActualValue: (id, n) =>
      adjustCredit(id, (c) => patchClearActualValue(c, n), () => repository.clearInstallmentValue(id, n)),

    cancelCreditRecurrence: (id, last) => {
      const credit = get().creditTransactions.find((c) => c.id === id);
      if (!credit) return "Compra não encontrada.";
      // `last` é um mês já contado pelo vencimento da fatura; o que fica salvo é o mês da cobrança
      const [shown] = resolveCredits([credit], get().creditCards);
      const result = patchCancelRecurrence(shown, last, getCurrentMonth());
      if (!result.ok) return result.error;
      const saved = { ok: true as const, patch: { endMonth: changeMonth(result.patch.endMonth!, -monthsDifference(shown.startMonth, credit.startMonth)) } };
      return adjustCredit(id, () => saved, () => repository.updateCredit(id, saved.patch));
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

    setTransactionPayment: (id, month, payment) => {
      const t = findTransaction(id);
      if (!t) return;
      const patch = payment ? patchSetPayment(t, month, payment) : patchClearPayment(t, month);
      set((state) => ({ transactions: state.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      sync(repository.setTransactionPayment(id, month, payment));
    },

    setExtraPayment: (id, payment) => {
      set((state) => ({ extraExpenses: state.extraExpenses.map((e) => (e.id === id ? { ...e, payment: payment ?? undefined } : e)) }));
      sync(repository.setExtraPayment(id, payment));
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
      getCreditByMonth(resolveCredits(get().creditTransactions, get().creditCards), month),

    getNotesByMonth: (month) => get().notes.filter((n) => n.month === month),
  };
});
