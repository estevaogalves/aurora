import { create } from "zustand";
import { uuid } from "@/lib/uuid";
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
  findSentMovements,
  goalOpeningMovements,
  overrideKey,
  paidMonths,
  openMonths,
  nextOpenAfter,
  installmentValueFor,
  debtCalendar,
  pruneSeenAlerts,
  replayGoal,
  todayISO,
  type GoalMovement,
  maturityAlertPrefix,
  patchCardAdjustments,
  renameCategoryIn,
  type CategoryPatch,
  patchCardPayment,
  patchEndFromMonth,
  patchResumeFixed,
  replayInvestment,
  type Investment,
  type InvestmentMovement,
  type CreditCard,
  type CreditTransaction,
  type FinanceData,
  type Budgets,
  type Debt,
  type DividendAsset,
  type MonthClosing,
  type ReceiptMeta,
  type CustomCategory,
  type DistributionItem,
  type ExtraExpense,
  type Goal,
  type Note,
  type OnboardingState,
  type InvoiceAdjustment,
  type Payment,
  type PaymentMethod,
  type Transaction,
  patchClearPayment,
  patchSetPayment,
} from "../domain";
import { repository } from "../repositories";
import type { Category } from "../Types/Category";
import { changeMonth, compareMonths, getCurrentMonth, monthsDifference } from "../Utils/Date";

export type { Investment, InvestmentMovement, CreditCard, CreditInstallment, CreditTransaction, CustomCategory, DistributionItem, ExtraExpense, Goal, Note, Transaction };

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
  /** histórico das metas e porquinhos: o guardado de cada um é refeito por ele */
  goalMovements: GoalMovement[];
  investments: Investment[];
  investmentMovements: InvestmentMovement[];
  extraExpenses: ExtraExpense[];
  customCategories: CustomCategory[];
  /** null = percentuais padrão */
  distribution: DistributionItem[] | null;
  /** percentuais próprios de uma distribuição (Dist 2 em diante) de um mês, por chave "AAAA-MM|n" */
  distributionOverrides: Record<string, DistributionItem[]>;
  /** Planejamento: orçamento por categoria, dívidas, fechamento do mês e carteira de dividendos (veja `Planning`). */
  budgets: Budgets;
  debts: Debt[];
  closings: Record<string, MonthClosing>;
  dividendAssets: DividendAsset[];
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
  /** Liga ou desliga o valor variável (estimado), em fixa ou avulsa. */
  setTransactionVariable: (id: string, variable: boolean) => void;
  /** Fixa variável: tira o valor real do mês e volta ao estimado. */
  clearTransactionActualValue: (id: string, month: string) => void;
  /** Encerra a fixa a partir de `month` (inclusive). Devolve a mensagem de erro, ou null se deu certo. */
  endTransactionFromMonth: (id: string, month: string) => string | null;
  /** Reativa uma fixa encerrada a partir de `month`; os meses desativados antes dele continuam desativados. */
  resumeTransaction: (id: string, month: string) => void;
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

  /** Cria a meta; o valor já guardado (`saved`) vira o "Saldo inicial" do histórico dela. */
  addGoal: (goal: Goal) => void;
  /** Muda nome, valor-alvo, aporte mensal e prazo. Um `saved` diferente do atual vira um ajuste no histórico. */
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  /** Registra aporte (ou retirada, se negativo) e rendimento (centavos) no histórico da meta. */
  contributeToGoal: (id: string, cents: number, yieldCents?: number, extra?: Pick<GoalMovement, "date" | "note" | "origin">) => void;
  /** Apaga a meta e o histórico dela. */
  removeGoal: (id: string) => void;
  addGoalMovement: (movement: GoalMovement) => void;
  updateGoalMovement: (id: string, patch: Partial<GoalMovement>) => void;
  removeGoalMovement: (id: string) => void;

  addInvestment: (investment: Investment, first?: Pick<InvestmentMovement, "amount" | "quantity" | "unitPrice">) => void;
  updateInvestment: (id: string, patch: Partial<Investment>) => void;
  /** Apaga o investimento e as movimentações dele. */
  removeInvestment: (id: string) => void;
  /** Registra aporte, resgate, rendimento ou ajuste (data "YYYY-MM-DD") e atualiza o valor atual. */
  addInvestmentMovement: (movement: InvestmentMovement) => void;
  updateInvestmentMovement: (id: string, patch: Partial<InvestmentMovement>) => void;
  removeInvestmentMovement: (id: string) => void;

  addCategory: (category: CustomCategory) => void;
  /** Troca o nome e/ou a cor de uma categoria própria; com nome novo, lançamentos e compras que a usavam acompanham. */
  updateCategory: (id: string, patch: CategoryPatch) => void;
  removeCategory: (id: string) => void;

  addExtraExpense: (extra: ExtraExpense) => void;
  updateExtraExpense: (id: string, patch: Partial<ExtraExpense>) => void;
  setDistribution: (items: DistributionItem[] | null) => void;
  /** Comprovantes anexados (só os dados; o conteúdo é baixado à parte). */
  receipts: ReceiptMeta[];
  /** Anexa um comprovante a um lançamento; devolve uma mensagem de erro pronta, ou null se deu certo. */
  attachReceipt: (transactionId: string, file: { name: string; data: ArrayBuffer }) => Promise<string | null>;
  removeReceipt: (id: string) => void;
  /** O conteúdo de um comprovante, para baixar. */
  loadReceipt: (id: string) => Promise<{ meta: ReceiptMeta; data: ArrayBuffer }>;
  /** Muda o limite mensal de uma categoria a partir de um mês (0 tira o limite desde o mês). Herda para os meses seguintes. */
  setBudget: (category: string, month: string, limit: number) => void;
  /** Tira o orçamento de uma categoria. */
  clearBudget: (category: string) => void;
  addDebt: (debt: Debt) => void;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  removeDebt: (id: string) => void;
  /** Registra uma parcela paga da dívida (avança a próxima parcela em um mês). */
  payDebtInstallment: (id: string, amount?: number) => void;
  /** Corrige o valor realmente pago numa parcela já paga (desconto ou acréscimo daquele mês). */
  setDebtPaidValue: (id: string, month: string, amount: number) => void;
  /** Desfaz a última parcela paga (usado quando o pagamento da despesa fixa vinculada é desmarcado). */
  unpayDebtInstallment: (id: string) => void;
  /**
   * Antecipa parcelas de uma dívida vinculada à despesa fixa: cria um lançamento avulso por parcela com o valor negociado
   * (já pago), zera aquele mês na despesa fixa e guarda o valor original. Só com a parcela do mês já paga.
   * Devolve uma mensagem de erro pronta, ou null se deu certo.
   */
  anticipateInstallments: (id: string, items: { month: string; paidValue: number }[], method?: PaymentMethod) => string | null;
  /** Desfaz a antecipação de uma parcela: apaga o lançamento avulso e devolve ao mês o valor original na despesa fixa. */
  undoAnticipation: (id: string, month: string) => void;
  /** Fecha um mês com o retrato e a anotação; fechar de novo substitui. */
  closeMonth: (month: string, closing: MonthClosing) => void;
  /** Reabre o mês (tira o fechamento). */
  reopenMonth: (month: string) => void;
  addDividendAsset: (asset: DividendAsset) => void;
  updateDividendAsset: (id: string, patch: Partial<DividendAsset>) => void;
  removeDividendAsset: (id: string) => void;
  /** Percentuais próprios de uma distribuição (Dist 2 em diante) deste mês; null volta ao padrão. Mexe só nela. */
  setDistributionOverride: (month: string, group: number, items: DistributionItem[] | null) => void;
  /**
   * Desfaz o envio de uma fatia: apaga os aportes (em metas, porquinhos e investimentos) que nasceram dela, e os
   * destinos voltam ao valor de antes. Devolve quantos aportes saíram.
   */
  undoDistributionSend: (month: string, source: string, slice: string) => number;
  markAlertsSeen: (keys: string[]) => void;
  markAlertUnseen: (key: string) => void;
  removeExtraExpense: (id: string) => void;
  /** Marca (ou troca) o pagamento de uma despesa em um mês; null desmarca. Só registro: não muda nenhum valor. */
  setTransactionPayment: (id: string, month: string, payment: Payment | null) => void;
  /** Liga a despesa avulsa a um cartão (com o dia da compra) ou a solta (`cardId` vazio). O dia da compra fica no histórico. */
  setTransactionCard: (id: string, cardId: string, purchaseDate?: string) => void;
  /** Renda variável: em qual distribuição do saldo entra (1 = Dist 1, o saldo do mês; 2 a 20 = própria). Só marca: não muda nenhum valor. */
  setTransactionDistGroup: (id: string, group: number) => void;
  /** dia do vencimento de uma despesa (1 a 31); 0 ou vazio tira o dia */
  setTransactionDueDay: (id: string, day: number) => void;
  /** etiquetas do lançamento (a lista inteira; vazia tira todas) */
  setTransactionTags: (id: string, tags: string[]) => void;
  /** Marca (ou troca) o pagamento da fatura do cartão que vence em `month`; null desmarca. Só registro. */
  setCardPayment: (cardId: string, month: string, payment: Payment | null) => void;
  /** Troca a lista de ajustes (descontos e acréscimos) da fatura que vence em `month`; lista vazia remove. */
  setCardAdjustments: (cardId: string, month: string, adjustments: InvoiceAdjustment[]) => void;
  /** Marca (ou troca) o pagamento de uma despesa extra; null desmarca. */
  setExtraPayment: (id: string, payment: Payment | null) => void;

  getTransactionsByMonth: (month: string) => Transaction[];
  getHiddenTransactionsByMonth: (month: string) => Transaction[];
  getCreditTransactionsByMonth: (month: string) => CreditInstallment[];
  getNotesByMonth: (month: string) => Note[];
}

/** Teto de um valor de planejamento: R$ 1 bilhão, o mesmo da API. */
const MAX_PLANNING_CENTS = 100_000_000_000;

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

  /** Grava o planejamento inteiro (orçamentos, dívidas, fechamentos e carteira): o servidor guarda tudo junto. */
  const savePlanning = () => {
    const { budgets, debts, closings, dividendAssets } = get();
    sync(repository.setPlanning({ budgets, debts, closings, dividendAssets }));
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

  /** Muda a lista de movimentações e refaz valor atual, cotas e preço médio do investimento a partir dela. */
  const applyMovements = (investmentId: string, change: (all: InvestmentMovement[]) => InvestmentMovement[], save: (r: typeof repository) => Promise<void>) => {
    const inv = get().investments.find((i) => i.id === investmentId);
    if (!inv) return;
    const movements = change(get().investmentMovements);
    const next = replayInvestment(inv, movements);
    set((state) => ({ investmentMovements: movements, investments: state.investments.map((i) => (i.id === investmentId ? next : i)) }));
    sync(save(repository));
    sync(repository.updateInvestment(investmentId, { currentValue: next.currentValue, quantity: next.quantity, avgPrice: next.avgPrice }));
  };

  /** Muda a lista de movimentações e refaz o guardado e os rendimentos da meta a partir dela. */
  const applyGoalMovements = (goalId: string, change: (all: GoalMovement[]) => GoalMovement[], save: (r: typeof repository) => Promise<void>) => {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const movements = change(get().goalMovements);
    const next = replayGoal(goal, movements);
    set((state) => ({ goalMovements: movements, goals: state.goals.map((g) => (g.id === goalId ? next : g)) }));
    sync(save(repository));
  };

  return {
    hydrated: false,

    replaceAll: async (data) => {
      await repository.replaceAll(data);
      await get().hydrate();
    },

    hydrate: async () => {
      const data = await repository.load();
      set({ ...data, goalMovements: data.goalMovements ?? [], distributionOverrides: data.distributionOverrides ?? {}, budgets: data.budgets ?? {}, debts: data.debts ?? [], closings: data.closings ?? {}, dividendAssets: data.dividendAssets ?? [], receipts: data.receipts ?? [], hydrated: true });
    },

    reset: () =>
      set({
        hydrated: false,
        transactions: [],
        creditTransactions: [],
        creditCards: [],
        notes: [],
        goals: [],
        goalMovements: [],
        investments: [],
        investmentMovements: [],
        extraExpenses: [],
        customCategories: [],
        distribution: null,
        distributionOverrides: {},
        budgets: {},
        debts: [],
        closings: {},
        dividendAssets: [],
        receipts: [],
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
    goalMovements: [],
    investments: [],
    investmentMovements: [],
    extraExpenses: [],
    customCategories: [],
    distribution: null,
    distributionOverrides: {},
    budgets: {},
    debts: [],
    closings: {},
    dividendAssets: [],
    receipts: [],
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
        // os comprovantes do lançamento vão junto (o repositório apaga os arquivos)
        receipts: state.receipts.filter((r) => r.transactionId !== id),
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
      // despesa no cartão não fixa: uma despesa fixa no cartão é uma recorrência (Lançar → Crédito parcelado)
      if (t && !t.cardId) patchTransaction(id, patchToggleFixed(t));
    },

    setTransactionVariable: (id, variable) => {
      // vale para fixa e para avulsa (renda ou despesa de um mês só)
      if (findTransaction(id)) patchTransaction(id, { variableAmount: variable });
    },

    clearTransactionActualValue: (id, month) => {
      const t = findTransaction(id);
      const patch = t && patchClearMonthValue(t, month);
      if (patch) patchTransaction(id, patch);
    },

    endTransactionFromMonth: (id, month) => {
      const t = findTransaction(id);
      if (!t) return "Lançamento não encontrado.";
      const result = patchEndFromMonth(t, month);
      if (!result.ok) return result.error;
      patchTransaction(id, result.patch);
      return null;
    },

    resumeTransaction: (id, month) => {
      const t = findTransaction(id);
      if (t?.fixed && t.endMonth) patchTransaction(id, patchResumeFixed(t, month));
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
        // despesas avulsas e extras também soltam o cartão: voltam a valer no mês em que foram lançadas, nenhuma some
        transactions: state.transactions.map((t) => (t.cardId === id ? { ...t, cardId: undefined } : t)),
        extraExpenses: state.extraExpenses.map((e) => (e.cardId === id ? { ...e, cardId: undefined } : e)),
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
      // o guardado é refeito pelo histórico: a meta nasce zerada e o valor que já tinha vira o "Saldo inicial"
      const { saved, yieldTotal, ...rest } = goal;
      const created: Goal = { ...rest, saved: 0 };
      set((state) => ({ goals: [...state.goals, created] }));
      sync(repository.addGoal(created));
      if (saved > 0 || (yieldTotal ?? 0) > 0) {
        for (const m of goalOpeningMovements([{ ...goal, id: goal.id }], [], todayISO())) {
          get().addGoalMovement({ ...m, id: uuid() });
        }
      }
    },

    updateGoal: (id, patch) => {
      const goal = get().goals.find((g) => g.id === id);
      if (!goal) return;
      // guardado e rendimentos só mudam pelo histórico: um `saved` novo vira um ajuste de valor
      const { saved, yieldTotal: _ignored, ...rest } = patch;
      void _ignored;
      set((state) => ({ goals: state.goals.map((g) => (g.id === id ? { ...g, ...rest } : g)) }));
      if (Object.keys(rest).length > 0) sync(repository.updateGoal(id, rest));
      if (saved !== undefined && saved !== goal.saved) {
        get().addGoalMovement({ id: uuid(), goalId: id, type: "adjustment", date: todayISO(), amount: Math.max(0, saved), note: "Ajuste do valor guardado" });
      }
    },

    contributeToGoal: (id, cents, yieldCents = 0, extra) => {
      if (!get().goals.some((g) => g.id === id)) return;
      const date = extra?.date ?? todayISO();
      const base = { goalId: id, date, ...(extra?.note && { note: extra.note }), ...(extra?.origin && { origin: extra.origin }) };
      if (cents !== 0) get().addGoalMovement({ id: uuid(), ...base, type: cents > 0 ? "contribution" : "withdrawal", amount: Math.abs(cents) });
      if (yieldCents !== 0) get().addGoalMovement({ id: uuid(), goalId: id, date, type: "yield", amount: yieldCents });
    },

    removeGoal: (id) => {
      const seenAlerts = get().seenAlerts.filter((k) => !k.startsWith(`${id}:`));
      set((state) => ({ goals: state.goals.filter((g) => g.id !== id), goalMovements: state.goalMovements.filter((m) => m.goalId !== id), seenAlerts }));
      sync(repository.removeGoal(id));
      sync(repository.setSeenAlerts(seenAlerts));
    },

    addGoalMovement: (movement) => {
      applyGoalMovements(movement.goalId, (all) => [...all, movement], (r) => r.addGoalMovement(movement));
    },

    updateGoalMovement: (id, patch) => {
      const current = get().goalMovements.find((m) => m.id === id);
      if (!current) return;
      applyGoalMovements(current.goalId, (all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)), (r) => r.updateGoalMovement(id, patch));
    },

    removeGoalMovement: (id) => {
      const current = get().goalMovements.find((m) => m.id === id);
      if (!current) return;
      applyGoalMovements(current.goalId, (all) => all.filter((m) => m.id !== id), (r) => r.removeGoalMovement(id));
    },

    addInvestment: (investment, first) => {
      // o valor investido na criação vira o primeiro aporte do histórico
      set((state) => ({ investments: [...state.investments, investment] }));
      sync(repository.addInvestment(investment));
      if (first && first.amount > 0) {
        const movement: InvestmentMovement = { id: uuid(), investmentId: investment.id, type: "contribution", date: investment.appliedAt, ...first };
        set((state) => ({ investmentMovements: [...state.investmentMovements, movement] }));
        sync(repository.addInvestmentMovement(movement));
      }
    },

    updateInvestment: (id, patch) => {
      set((state) => ({ investments: state.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      sync(repository.updateInvestment(id, patch));
    },

    removeInvestment: (id) => {
      // os avisos de vencimento vistos deste investimento saem junto (como acontece com as metas)
      const seenAlerts = get().seenAlerts.filter((k) => !k.startsWith(maturityAlertPrefix(id)));
      const changed = seenAlerts.length !== get().seenAlerts.length;
      set((state) => ({
        investments: state.investments.filter((i) => i.id !== id),
        investmentMovements: state.investmentMovements.filter((m) => m.investmentId !== id),
        seenAlerts,
      }));
      sync(repository.removeInvestment(id));
      if (changed) sync(repository.setSeenAlerts(seenAlerts));
    },

    addInvestmentMovement: (movement) => {
      applyMovements(movement.investmentId, (all) => [...all, movement], (r) => r.addInvestmentMovement(movement));
    },

    updateInvestmentMovement: (id, patch) => {
      const current = get().investmentMovements.find((m) => m.id === id);
      if (!current) return;
      applyMovements(current.investmentId, (all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)), (r) => r.updateInvestmentMovement(id, patch));
    },

    removeInvestmentMovement: (id) => {
      const current = get().investmentMovements.find((m) => m.id === id);
      if (!current) return;
      applyMovements(current.investmentId, (all) => all.filter((m) => m.id !== id), (r) => r.removeInvestmentMovement(id));
    },

    addCategory: (category) => {
      set((state) => ({ customCategories: [...state.customCategories, category] }));
      sync(repository.addCategory(category));
    },

    updateCategory: (id, patch) => {
      const current = get().customCategories.find((c) => c.id === id);
      if (!current) return;
      const renamed = patch.name !== undefined && patch.name !== current.name ? patch.name : null;
      set((state) => ({
        customCategories: state.customCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ...(renamed !== null && {
          transactions: renameCategoryIn(state.transactions, current.name, renamed),
          creditTransactions: renameCategoryIn(state.creditTransactions, current.name, renamed),
        }),
      }));
      sync(repository.updateCategory(id, patch));
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
      const next = pruneSeenAlerts([...new Set([...get().seenAlerts, ...keys])], todayISO());
      set({ seenAlerts: next });
      sync(repository.setSeenAlerts(next));
    },

    markAlertUnseen: (key) => {
      const next = get().seenAlerts.filter((k) => k !== key);
      set({ seenAlerts: next });
      sync(repository.setSeenAlerts(next));
    },

    setDistributionOverride: (month, group, items) => {
      if (group < 2) return;
      const key = overrideKey(month, group);
      set((state) => {
        const rest = { ...state.distributionOverrides };
        if (items) rest[key] = items;
        else delete rest[key];
        return { distributionOverrides: rest };
      });
      sync(repository.setDistributionOverride(month, group, items));
    },

    undoDistributionSend: (month, source, slice) => {
      const found = findSentMovements(get(), month, source, slice);
      for (const m of found.goalMovements) get().removeGoalMovement(m.id);
      for (const m of found.investmentMovements) get().removeInvestmentMovement(m.id);
      return found.goalMovements.length + found.investmentMovements.length;
    },

    attachReceipt: async (transactionId, file) => {
      try {
        const meta = await repository.addReceipt(transactionId, file);
        set((s) => ({ receipts: [...s.receipts, meta] }));
        return null;
      } catch (error) {
        return error instanceof Error && error.message ? error.message : "Não foi possível anexar o comprovante.";
      }
    },
    removeReceipt: (id) => {
      set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) }));
      sync(repository.removeReceipt(id));
    },
    loadReceipt: (id) => repository.getReceipt(id),

    setBudget: (category, month, limit) => {
      const valid = Number.isInteger(limit) && limit >= 0 && limit <= MAX_PLANNING_CENTS;
      if (!valid || !category.trim()) return;
      set((s) => ({ budgets: { ...s.budgets, [category]: { ...s.budgets[category], [month]: limit } } }));
      savePlanning();
    },
    clearBudget: (category) => {
      set((s) => {
        const rest = { ...s.budgets };
        delete rest[category];
        return { budgets: rest };
      });
      savePlanning();
    },
    addDebt: (debt) => {
      set((s) => ({ debts: [...s.debts, debt] }));
      savePlanning();
    },
    updateDebt: (id, patch) => {
      set((s) => ({ debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
      savePlanning();
    },
    removeDebt: (id) => {
      set((s) => ({ debts: s.debts.filter((d) => d.id !== id) }));
      savePlanning();
    },
    payDebtInstallment: (id, amount) => {
      const d = get().debts.find((x) => x.id === id);
      if (!d || openMonths(d).length === 0) return;
      // com valor, guarda o que foi realmente pago nesta parcela (desconto ou acréscimo)
      const valid = amount !== undefined && Number.isInteger(amount) && amount >= 0 && amount <= MAX_PLANNING_CENTS;
      set((s) => ({
        debts: s.debts.map((x) => (x.id === id ? { ...x, paidInstallments: x.paidInstallments + 1, nextMonth: nextOpenAfter(x, x.nextMonth), ...(valid && { paidValues: { ...x.paidValues, [x.nextMonth]: amount } }) } : x)),
      }));
      savePlanning();
    },
    unpayDebtInstallment: (id) => {
      const d = get().debts.find((x) => x.id === id);
      if (!d || d.paidInstallments <= 0) return;
      const last = paidMonths(d).at(-1) ?? changeMonth(d.nextMonth, -1);
      set((s) => ({
        debts: s.debts.map((x) => {
          if (x.id !== id) return x;
          const rest = { ...x.paidValues };
          delete rest[last];
          return { ...x, paidInstallments: x.paidInstallments - 1, nextMonth: last, paidValues: Object.keys(rest).length > 0 ? rest : undefined };
        }),
      }));
      savePlanning();
    },
    anticipateInstallments: (id, items, method = "pix") => {
      const d = get().debts.find((x) => x.id === id);
      if (!d) return "Dívida não encontrada.";
      const linked = d.linkedTransactionId ? findTransaction(d.linkedTransactionId) : undefined;
      if (!linked) return "A antecipação precisa da despesa fixa vinculada.";
      if (items.length === 0) return "Escolha ao menos uma parcela para antecipar.";
      if (compareMonths(d.nextMonth, getCurrentMonth()) <= 0) return `Pague primeiro a parcela de ${d.nextMonth.slice(5)}/${d.nextMonth.slice(0, 4)}: a antecipação vai junto com o pagamento da parcela em aberto mais próxima.`;
      const open = openMonths(d);
      const seen = new Set<string>();
      for (const { month, paidValue } of items) {
        if (seen.has(month)) return "Uma parcela foi escolhida duas vezes.";
        seen.add(month);
        if (month === d.nextMonth || !open.includes(month)) return `A parcela de ${month.slice(5)}/${month.slice(0, 4)} não está em aberto para antecipar.`;
        if (!Number.isInteger(paidValue) || paidValue <= 0 || paidValue > MAX_PLANNING_CENTS) return "Informe o valor pago de cada parcela antecipada (maior que zero).";
      }
      const batchId = uuid();
      const today = todayISO();
      const thisMonth = getCurrentMonth();
      const anticipations = { ...d.anticipations };
      let monthlyValues = { ...linked.monthlyValues };
      const transactions = get().transactions;
      for (const { month, paidValue } of items) {
        const originalValue = installmentValueFor(d, month, transactions);
        const transactionId = uuid();
        const label = `${month.slice(5)}/${month.slice(0, 4)}`;
        get().addTransaction({
          id: transactionId,
          name: `${d.name}: antecipação da parcela ${label}`,
          amount: paidValue,
          type: "expense",
          category: linked.category,
          month: thisMonth,
          tags: ["consórcio"],
          payments: { [thisMonth]: { method, date: today } },
        });
        monthlyValues = { ...monthlyValues, [month]: 0 };
        anticipations[month] = { originalValue, paidValue, paidOn: today, batchId, transactionId };
      }
      // o mês da parcela antecipada passa a valer zero na despesa fixa: o desembolso fica só no lançamento avulso
      patchTransaction(linked.id, { monthlyValues });
      set((s) => ({ debts: s.debts.map((x) => (x.id === id ? { ...x, startMonth: x.startMonth ?? debtCalendar(x)[0], anticipations } : x)) }));
      savePlanning();
      return null;
    },
    undoAnticipation: (id, month) => {
      const d = get().debts.find((x) => x.id === id);
      const a = d?.anticipations?.[month];
      // antecipada que ficou para trás da próxima parcela já não é uma antecipação: o calendário seguiria fora de ordem
      if (!d || !a || compareMonths(month, d.nextMonth) < 0) return;
      if (get().transactions.some((t) => t.id === a.transactionId)) get().removeTransaction(a.transactionId);
      const linked = d.linkedTransactionId ? findTransaction(d.linkedTransactionId) : undefined;
      if (linked) {
        const monthlyValues = { ...linked.monthlyValues };
        if (a.originalValue === linked.amount) delete monthlyValues[month];
        else monthlyValues[month] = a.originalValue;
        patchTransaction(linked.id, { monthlyValues: Object.keys(monthlyValues).length > 0 ? monthlyValues : undefined });
      }
      set((s) => ({
        debts: s.debts.map((x) => {
          if (x.id !== id) return x;
          const rest = { ...x.anticipations };
          delete rest[month];
          // o `nextMonth` continua válido (a antecipada é sempre depois dele) e o calendário (`startMonth`) é mantido
          return { ...x, anticipations: Object.keys(rest).length === 0 ? undefined : rest };
        }),
      }));
      savePlanning();
    },
    setDebtPaidValue: (id, month, amount) => {
      const d = get().debts.find((x) => x.id === id);
      if (!d || !paidMonths(d).includes(month)) return;
      if (!Number.isInteger(amount) || amount < 0 || amount > MAX_PLANNING_CENTS) return;
      set((s) => ({ debts: s.debts.map((x) => (x.id === id ? { ...x, paidValues: { ...x.paidValues, [month]: amount } } : x)) }));
      savePlanning();
    },
    closeMonth: (month, closing) => {
      set((s) => ({ closings: { ...s.closings, [month]: closing } }));
      savePlanning();
    },
    reopenMonth: (month) => {
      set((s) => {
        const rest = { ...s.closings };
        delete rest[month];
        return { closings: rest };
      });
      savePlanning();
    },
    addDividendAsset: (asset) => {
      set((s) => ({ dividendAssets: [...s.dividendAssets, asset] }));
      savePlanning();
    },
    updateDividendAsset: (id, patch) => {
      set((s) => ({ dividendAssets: s.dividendAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      savePlanning();
    },
    removeDividendAsset: (id) => {
      set((s) => ({ dividendAssets: s.dividendAssets.filter((a) => a.id !== id) }));
      savePlanning();
    },

    setDistribution: (items) => {
      set({ distribution: items });
      sync(repository.setDistribution(items));
    },

    setTransactionPayment: (id, month, payment) => {
      const t = findTransaction(id);
      // despesa no cartão não é paga sozinha: o pagamento é da fatura (desmarcar um registro antigo continua permitido)
      if (!t || (t.cardId && payment)) return;
      const patch = payment ? patchSetPayment(t, month, payment) : patchClearPayment(t, month);
      set((state) => ({ transactions: state.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      sync(repository.setTransactionPayment(id, month, payment));
      // dívida vinculada a esta despesa fixa: o pagamento do mês da próxima parcela registra a parcela sozinho (sem valor
      // próprio: o valor segue o lançamento); desmarcar o pagamento da última parcela paga a desfaz
      for (const d of get().debts.filter((x) => x.linkedTransactionId === id)) {
        if (payment && month === d.nextMonth && openMonths(d).length > 0) get().payDebtInstallment(d.id);
        else if (!payment && d.paidInstallments > 0 && paidMonths(d).at(-1) === month) get().unpayDebtInstallment(d.id);
      }
    },

    setTransactionDistGroup: (id, group) => {
      const t = findTransaction(id);
      // só renda não fixa pode ter distribuição própria (o servidor também recusa o resto)
      if (!t || t.type !== "income" || t.fixed) return;
      patchTransaction(id, { distGroup: group >= 2 ? group : undefined });
    },

    setTransactionTags: (id, tags) => {
      if (!get().transactions.some((t) => t.id === id)) return;
      patchTransaction(id, { tags: tags.length > 0 ? tags : undefined });
    },

    setTransactionDueDay: (id, day) => {
      const t = findTransaction(id);
      // só despesa tem vencimento (o servidor também recusa o resto)
      if (!t || t.type !== "expense") return;
      const valid = Number.isInteger(day) && day >= 1 && day <= 31;
      patchTransaction(id, { dueDay: valid ? day : undefined });
    },

    setTransactionCard: (id, cardId, purchaseDate) => {
      patchTransaction(id, { cardId: cardId || undefined, ...(cardId && purchaseDate && { purchaseDate }) });
    },

    setCardPayment: (cardId, month, payment) => {
      if (!get().creditCards.some((k) => k.id === cardId)) return;
      set((state) => ({ creditCards: state.creditCards.map((k) => (k.id === cardId ? { ...k, ...patchCardPayment(k, month, payment) } : k)) }));
      sync(repository.setCardPayment(cardId, month, payment));
    },

    setCardAdjustments: (cardId, month, adjustments) => {
      if (!get().creditCards.some((k) => k.id === cardId)) return;
      set((state) => ({ creditCards: state.creditCards.map((k) => (k.id === cardId ? { ...k, ...patchCardAdjustments(k, month, adjustments) } : k)) }));
      sync(repository.setCardAdjustments(cardId, month, adjustments));
    },

    setExtraPayment: (id, payment) => {
      if (payment && get().extraExpenses.find((e) => e.id === id)?.cardId) return;
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
