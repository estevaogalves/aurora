import { api } from "../api/http";
import type {
  CreditCard,
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
import type { FinanceRepository } from "./FinanceRepository";

/** Copia só as chaves permitidas que existem no objeto (o PATCH da API muda só o que vier). */
function pick<T extends object>(source: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

const TRANSACTION_PATCH = ["name", "amount", "category", "notes", "fixed", "hiddenMonths", "monthlyValues", "monthlyNotes", "variableAmount"] as const;
const CREDIT_PATCH = ["name", "totalAmount", "installments", "startMonth", "category", "endMonth", "billingDay", "cardId", "variableAmount"] as const;
const CARD_PATCH = ["name", "closingDay", "dueDay"] as const;
const GOAL_PATCH = ["name", "target", "saved", "monthly", "yieldTotal", "deadline"] as const;
const EXTRA_PATCH = ["name", "amount", "month"] as const;
const NOTE_PATCH = ["content", "date", "pinned", "month"] as const;

/**
 * A API devolve `fixed`, `hiddenMonths`, `monthlyValues`, `notes` e `yieldTotal` só quando têm valor
 * (`omitempty` em Go). Aqui voltam ao formato que o resto do app espera.
 */
export function normalizeFinanceData(raw: Partial<FinanceData>): FinanceData {
  return {
    transactions: (raw.transactions ?? []).map((t) => {
      const fixed = t.fixed === true;
      return {
        ...t,
        fixed,
        notes: t.notes ?? "",
        hiddenMonths: fixed ? (t.hiddenMonths ?? []) : undefined,
        monthlyValues: fixed ? (t.monthlyValues ?? {}) : undefined,
      };
    }),
    creditTransactions: raw.creditTransactions ?? [],
    creditCards: raw.creditCards ?? [],
    notes: raw.notes ?? [],
    investments: [],
    investmentMovements: [],
    goals: (raw.goals ?? []).map((g) => ({ ...g, deadline: g.deadline ?? null, yieldTotal: g.yieldTotal ?? 0 })),
    extraExpenses: raw.extraExpenses ?? [],
    customCategories: raw.customCategories ?? [],
    distribution: raw.distribution ?? null,
    seenAlerts: raw.seenAlerts ?? [],
    onboarding: raw.onboarding ?? {},
  };
}

/**
 * Guarda tudo no backend. A store atualiza a tela na hora e avisa o repositório depois,
 * então as chamadas entram numa fila: um PATCH nunca passa na frente do POST que criou o registro.
 */
export class ApiRepository implements FinanceRepository {
  private queue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async load(): Promise<FinanceData> {
    // espera as gravações pendentes, para não ler dados antigos
    await this.queue;
    return normalizeFinanceData(await api.get<Partial<FinanceData>>("/data"));
  }

  replaceAll = (data: FinanceData) => this.enqueue(async () => { await api.post("/import?replace=true", data); });
  addTransaction = (t: Transaction) => this.enqueue(() => api.post("/transactions", t));
  updateTransaction = (id: string, patch: Partial<Transaction>) =>
    this.enqueue(() => api.patch(`/transactions/${id}`, pick(patch, TRANSACTION_PATCH)));
  removeTransaction = (id: string) => this.enqueue(() => api.delete(`/transactions/${id}`));

  addCredit = (c: CreditTransaction) => this.enqueue(() => api.post("/credits", c));
  updateCredit = (id: string, patch: Partial<CreditTransaction>) =>
    this.enqueue(() => api.patch(`/credits/${id}`, pick(patch, CREDIT_PATCH)));
  removeCredit = (id: string) => this.enqueue(() => api.delete(`/credits/${id}`));
  addCreditCard = (c: CreditCard) => this.enqueue(() => api.post("/credit-cards", c));
  updateCreditCard = (id: string, patch: Partial<CreditCard>) =>
    this.enqueue(() => api.patch(`/credit-cards/${id}`, pick(patch, CARD_PATCH)));
  removeCreditCard = (id: string) => this.enqueue(() => api.delete(`/credit-cards/${id}`));
  advanceInstallment = (id: string, n: number, discount: number) =>
    this.enqueue(() => api.post(`/credits/${id}/installments/${n}/advance`, { discount }));
  editInstallment = (id: string, n: number, cents: number) =>
    this.enqueue(() => api.put(`/credits/${id}/installments/${n}`, { value: cents }));
  clearInstallmentValue = (id: string, n: number) => this.enqueue(() => api.delete(`/credits/${id}/installments/${n}/value`));
  removeInstallment = (id: string, n: number) => this.enqueue(() => api.delete(`/credits/${id}/installments/${n}`));

  setTransactionPayment = (id: string, month: string, payment: Payment | null) =>
    this.enqueue(() => (payment ? api.put(`/transactions/${id}/payments/${month}`, payment) : api.delete(`/transactions/${id}/payments/${month}`)));
  setExtraPayment = (id: string, payment: Payment | null) =>
    this.enqueue(() => (payment ? api.put(`/extra-expenses/${id}/payment`, payment) : api.delete(`/extra-expenses/${id}/payment`)));

  addNote = (n: Note) => this.enqueue(() => api.post("/notes", n));
  updateNote = (id: string, patch: Partial<Note>) => this.enqueue(() => api.patch(`/notes/${id}`, pick(patch, NOTE_PATCH)));
  removeNote = (id: string) => this.enqueue(() => api.delete(`/notes/${id}`));

  // investimentos ainda não existem no backend (próxima etapa do plano)
  addInvestment = () => this.unsupported();
  updateInvestment = () => this.unsupported();
  removeInvestment = () => this.unsupported();
  addInvestmentMovement = () => this.unsupported();
  updateInvestmentMovement = () => this.unsupported();
  removeInvestmentMovement = () => this.unsupported();
  private unsupported = () => Promise.reject(new Error("Investimentos ainda não estão disponíveis na API"));

  addGoal = (g: Goal) => this.enqueue(() => api.post("/goals", g));
  // `deadline: null` limpa o prazo na API; sem a chave ele não muda
  updateGoal = (id: string, patch: Partial<Goal>) => this.enqueue(() => api.patch(`/goals/${id}`, pick(patch, GOAL_PATCH)));
  removeGoal = (id: string) => this.enqueue(() => api.delete(`/goals/${id}`));

  addExtraExpense = (e: ExtraExpense) => this.enqueue(() => api.post("/extra-expenses", e));
  updateExtraExpense = (id: string, patch: Partial<ExtraExpense>) =>
    this.enqueue(() => api.patch(`/extra-expenses/${id}`, pick(patch, EXTRA_PATCH)));
  removeExtraExpense = (id: string) => this.enqueue(() => api.delete(`/extra-expenses/${id}`));

  addCategory = (c: CustomCategory) => this.enqueue(() => api.post("/categories", c));
  removeCategory = (id: string) => this.enqueue(() => api.delete(`/categories/${id}`));

  setDistribution = (items: DistributionItem[] | null) => this.enqueue(() => api.put("/settings/distribution", { items }));
  setSeenAlerts = (keys: string[]) => this.enqueue(() => api.put("/settings/seen-alerts", { keys }));
  setOnboarding = (screen: string, state: OnboardingState) =>
    this.enqueue(() => api.put(`/settings/onboarding/${encodeURIComponent(screen)}`, { state }));
}
