import { api } from "../api/http";
import type { CategoryPatch } from "../domain/categories";
import type {
  CreditCard,
  CreditTransaction,
  CustomCategory,
  DistributionItem,
  ExtraExpense,
  FinanceData,
  Goal,
  GoalMovement,
  Investment,
  InvestmentMovement,
  Note,
  OnboardingState,
  InvoiceAdjustment,
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

const TRANSACTION_PATCH = ["name", "amount", "category", "notes", "fixed", "hiddenMonths", "monthlyValues", "monthlyNotes", "variableAmount", "cardId", "purchaseDate", "endMonth", "distGroup"] as const;
const CREDIT_PATCH = ["name", "totalAmount", "installments", "startMonth", "category", "endMonth", "billingDay", "cardId", "variableAmount"] as const;
const CARD_PATCH = ["name", "closingDay", "dueDay", "limit"] as const;
// guardado e rendimentos não vão aqui: são refeitos pelo histórico (`/goal-movements`)
const GOAL_PATCH = ["name", "target", "monthly", "deadline"] as const;
const GOAL_MOVEMENT_PATCH = ["type", "date", "amount", "note", "origin"] as const;
const INVESTMENT_PATCH = [
  "name", "family", "product", "institution", "appliedAt", "currentValue", "maturityDate", "indexer", "rate",
  "liquidity", "graceUntil", "earlyRedeem", "quantity", "avgPrice", "redeemDays", "ticker", "fees", "notes",
] as const;
const MOVEMENT_PATCH = ["type", "date", "amount", "quantity", "unitPrice", "note", "origin"] as const;
const EXTRA_PATCH = ["name", "amount", "month", "cardId", "purchaseDate"] as const;
const NOTE_PATCH = ["content", "date", "pinned", "month"] as const;

/**
 * O front limpa um campo opcional deixando-o `undefined`, mas o JSON descarta `undefined` e a API entenderia
 * "não mudou". Aqui cada campo limpo vira o que a API aceita: texto vazio, `false`, 0 ou `null` (cotas e preços).
 */
export function investmentPatchBody(patch: Partial<Investment>): Record<string, unknown> {
  const body: Record<string, unknown> = pick(patch, INVESTMENT_PATCH);
  const cleared: Record<string, unknown> = {
    product: "", maturityDate: "", indexer: "", rate: "", liquidity: "", graceUntil: "", ticker: "", fees: "", notes: "",
    earlyRedeem: false, redeemDays: 0, quantity: null, avgPrice: null,
  };
  for (const [key, empty] of Object.entries(cleared)) if (key in body && body[key] === undefined) body[key] = empty;
  return body;
}

/**
 * Despesa avulsa ou extra no cartão: soltar o cartão deixa `cardId` como `undefined` na store, e o JSON descartaria a
 * chave (a API entenderia "não mudou"). Aqui vira `""`, que solta o cartão. O dia da compra fica como está.
 */
export function cardExpensePatchBody<T extends { cardId?: string }>(patch: Partial<T>, keys: readonly (keyof T)[]): Record<string, unknown> {
  const body: Record<string, unknown> = pick(patch as T, keys);
  if ("cardId" in body && body.cardId === undefined) body.cardId = "";
  // fixa reativada: `endMonth` limpo (undefined) vira "", que tira o fim
  if ("endMonth" in body && body.endMonth === undefined) body.endMonth = "";
  // volta para a Dist 1 (undefined) vira 0, que tira a distribuição própria; sem a chave a API entenderia "não mudou"
  if ("distGroup" in body && body.distGroup === undefined) body.distGroup = 0;
  return body;
}

/** Teto do cartão limpo (`undefined`) vira 0, que tira o teto; sem 0 a API entenderia "não mudou". */
export function cardPatchBody(patch: Partial<CreditCard>): Record<string, unknown> {
  const body: Record<string, unknown> = pick(patch, CARD_PATCH);
  if ("limit" in body && body.limit === undefined) body.limit = 0;
  return body;
}

export function movementPatchBody(patch: Partial<InvestmentMovement>): Record<string, unknown> {
  const body: Record<string, unknown> = pick(patch, MOVEMENT_PATCH);
  for (const key of ["quantity", "unitPrice"]) if (key in body && body[key] === undefined) body[key] = null;
  // observação e origem limpas (undefined) viram texto vazio, que as apaga; sem a chave, não mudam
  for (const key of ["note", "origin"]) if (key in body && body[key] === undefined) body[key] = "";
  return body;
}

export function goalMovementPatchBody(patch: Partial<GoalMovement>): Record<string, unknown> {
  const body: Record<string, unknown> = pick(patch, GOAL_MOVEMENT_PATCH);
  for (const key of ["note", "origin"]) if (key in body && body[key] === undefined) body[key] = "";
  return body;
}

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
    investments: raw.investments ?? [],
    investmentMovements: raw.investmentMovements ?? [],
    goalMovements: raw.goalMovements ?? [],
    goals: (raw.goals ?? []).map((g) => ({ ...g, deadline: g.deadline ?? null, yieldTotal: g.yieldTotal ?? 0 })),
    extraExpenses: raw.extraExpenses ?? [],
    customCategories: raw.customCategories ?? [],
    distribution: raw.distribution ?? null,
    distributionOverrides: raw.distributionOverrides ?? {},
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
    this.enqueue(() => api.patch(`/transactions/${id}`, cardExpensePatchBody(patch, TRANSACTION_PATCH)));
  removeTransaction = (id: string) => this.enqueue(() => api.delete(`/transactions/${id}`));

  addCredit = (c: CreditTransaction) => this.enqueue(() => api.post("/credits", c));
  updateCredit = (id: string, patch: Partial<CreditTransaction>) =>
    this.enqueue(() => api.patch(`/credits/${id}`, pick(patch, CREDIT_PATCH)));
  removeCredit = (id: string) => this.enqueue(() => api.delete(`/credits/${id}`));
  addCreditCard = (c: CreditCard) => this.enqueue(() => api.post("/credit-cards", c));
  updateCreditCard = (id: string, patch: Partial<CreditCard>) =>
    this.enqueue(() => api.patch(`/credit-cards/${id}`, cardPatchBody(patch)));
  removeCreditCard = (id: string) => this.enqueue(() => api.delete(`/credit-cards/${id}`));
  advanceInstallment = (id: string, n: number, discount: number) =>
    this.enqueue(() => api.post(`/credits/${id}/installments/${n}/advance`, { discount }));
  editInstallment = (id: string, n: number, cents: number) =>
    this.enqueue(() => api.put(`/credits/${id}/installments/${n}`, { value: cents }));
  clearInstallmentValue = (id: string, n: number) => this.enqueue(() => api.delete(`/credits/${id}/installments/${n}/value`));
  removeInstallment = (id: string, n: number) => this.enqueue(() => api.delete(`/credits/${id}/installments/${n}`));

  setTransactionPayment = (id: string, month: string, payment: Payment | null) =>
    this.enqueue(() => (payment ? api.put(`/transactions/${id}/payments/${month}`, payment) : api.delete(`/transactions/${id}/payments/${month}`)));
  setCardPayment = (id: string, month: string, payment: Payment | null) =>
    this.enqueue(() => (payment ? api.put(`/credit-cards/${id}/payments/${month}`, payment) : api.delete(`/credit-cards/${id}/payments/${month}`)));
  setCardAdjustments = (id: string, month: string, adjustments: InvoiceAdjustment[]) =>
    this.enqueue(() => (adjustments.length > 0 ? api.put(`/credit-cards/${id}/adjustments/${month}`, adjustments) : api.delete(`/credit-cards/${id}/adjustments/${month}`)));
  setExtraPayment = (id: string, payment: Payment | null) =>
    this.enqueue(() => (payment ? api.put(`/extra-expenses/${id}/payment`, payment) : api.delete(`/extra-expenses/${id}/payment`)));

  addNote = (n: Note) => this.enqueue(() => api.post("/notes", n));
  updateNote = (id: string, patch: Partial<Note>) => this.enqueue(() => api.patch(`/notes/${id}`, pick(patch, NOTE_PATCH)));
  removeNote = (id: string) => this.enqueue(() => api.delete(`/notes/${id}`));

  // Valor atual, cotas e preço médio: o servidor refaz a cada movimentação (mesma regra do replayInvestment),
  // então o PATCH que a store manda em seguida só confirma o que já está lá.
  addInvestment = (i: Investment) => this.enqueue(() => api.post("/investments", i));
  updateInvestment = (id: string, patch: Partial<Investment>) => this.enqueue(() => api.patch(`/investments/${id}`, investmentPatchBody(patch)));
  removeInvestment = (id: string) => this.enqueue(() => api.delete(`/investments/${id}`));
  addInvestmentMovement = (m: InvestmentMovement) => this.enqueue(() => api.post("/investment-movements", m));
  updateInvestmentMovement = (id: string, patch: Partial<InvestmentMovement>) =>
    this.enqueue(() => api.patch(`/investment-movements/${id}`, movementPatchBody(patch)));
  removeInvestmentMovement = (id: string) => this.enqueue(() => api.delete(`/investment-movements/${id}`));

  addGoal = (g: Goal) => this.enqueue(() => api.post("/goals", g));
  // `deadline: null` limpa o prazo na API; sem a chave ele não muda
  updateGoal = (id: string, patch: Partial<Goal>) => this.enqueue(() => api.patch(`/goals/${id}`, pick(patch, GOAL_PATCH)));
  removeGoal = (id: string) => this.enqueue(() => api.delete(`/goals/${id}`));
  // o servidor refaz o guardado e os rendimentos da meta a cada movimentação (mesma regra do replayGoal)
  addGoalMovement = (m: GoalMovement) => this.enqueue(() => api.post("/goal-movements", m));
  updateGoalMovement = (id: string, patch: Partial<GoalMovement>) => this.enqueue(() => api.patch(`/goal-movements/${id}`, goalMovementPatchBody(patch)));
  removeGoalMovement = (id: string) => this.enqueue(() => api.delete(`/goal-movements/${id}`));

  addExtraExpense = (e: ExtraExpense) => this.enqueue(() => api.post("/extra-expenses", e));
  updateExtraExpense = (id: string, patch: Partial<ExtraExpense>) =>
    this.enqueue(() => api.patch(`/extra-expenses/${id}`, cardExpensePatchBody(patch, EXTRA_PATCH)));
  removeExtraExpense = (id: string) => this.enqueue(() => api.delete(`/extra-expenses/${id}`));

  addCategory = (c: CustomCategory) => this.enqueue(() => api.post("/categories", c));
  updateCategory = (id: string, patch: CategoryPatch) => this.enqueue(() => api.patch(`/categories/${id}`, pick(patch, ["name", "color"])));
  removeCategory = (id: string) => this.enqueue(() => api.delete(`/categories/${id}`));

  setDistribution = (items: DistributionItem[] | null) => this.enqueue(() => api.put("/settings/distribution", { items }));
  setDistributionOverride = (month: string, group: number, items: DistributionItem[] | null) =>
    this.enqueue(() => api.put(`/settings/distribution-overrides/${month}/${group}`, { items }));
  setSeenAlerts = (keys: string[]) => this.enqueue(() => api.put("/settings/seen-alerts", { keys }));
  setOnboarding = (screen: string, state: OnboardingState) =>
    this.enqueue(() => api.put(`/settings/onboarding/${encodeURIComponent(screen)}`, { state }));
}
