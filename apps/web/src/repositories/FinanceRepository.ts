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

/**
 * De onde vêm e para onde vão os dados.
 * Hoje: LocalRepository (localStorage). Depois: ApiRepository (backend Go).
 * A store só conhece esta interface.
 */
export interface FinanceRepository {
  load(): Promise<FinanceData>;
  /** Troca TODOS os dados pelos informados (restaurar um backup). */
  replaceAll(data: FinanceData): Promise<void>;

  addTransaction(transaction: Transaction): Promise<void>;
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<void>;
  removeTransaction(id: string): Promise<void>;

  addCredit(credit: CreditTransaction): Promise<void>;
  updateCredit(id: string, patch: Partial<CreditTransaction>): Promise<void>;
  removeCredit(id: string): Promise<void>;
  addCreditCard(card: CreditCard): Promise<void>;
  updateCreditCard(id: string, patch: Partial<CreditCard>): Promise<void>;
  /** Apaga o cartão; as compras ligadas a ele ficam sem cartão (nada é apagado). */
  removeCreditCard(id: string): Promise<void>;
  /** Adianta a última parcela (futura): cobra o valor com desconto no mês atual. Desconto em centavos. */
  advanceInstallment(id: string, n: number, discount: number): Promise<void>;
  /** Muda só o valor (centavos) de uma parcela. */
  editInstallment(id: string, n: number, cents: number): Promise<void>;
  /** Recorrência variável: tira o valor real de um mês (volta ao estimado). */
  clearInstallmentValue(id: string, n: number): Promise<void>;
  /** Exclui só uma parcela. */
  removeInstallment(id: string, n: number): Promise<void>;

  /** Marca (ou troca) o pagamento de uma despesa em um mês; null desmarca. Só registro, não muda valores. */
  setTransactionPayment(id: string, month: string, payment: Payment | null): Promise<void>;
  /** Marca (ou troca) o pagamento de uma despesa extra; null desmarca. */
  setExtraPayment(id: string, payment: Payment | null): Promise<void>;
  /** Marca (ou troca) o pagamento da fatura do cartão que vence em `month`; null desmarca. Só registro, não muda valores. */
  setCardPayment(id: string, month: string, payment: Payment | null): Promise<void>;
  /** Troca a lista de ajustes da fatura do cartão que vence em `month`; lista vazia remove. Só registro, não muda despesas. */
  setCardAdjustments(id: string, month: string, adjustments: InvoiceAdjustment[]): Promise<void>;

  addNote(note: Note): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  removeNote(id: string): Promise<void>;

  addGoal(goal: Goal): Promise<void>;
  updateGoal(id: string, patch: Partial<Goal>): Promise<void>;
  /** Apaga a meta e o histórico dela. */
  removeGoal(id: string): Promise<void>;
  /** Histórico de metas e porquinhos: o guardado é refeito pelas movimentações (`replayGoal`). */
  addGoalMovement(movement: GoalMovement): Promise<void>;
  updateGoalMovement(id: string, patch: Partial<GoalMovement>): Promise<void>;
  removeGoalMovement(id: string): Promise<void>;

  addInvestment(investment: Investment): Promise<void>;
  updateInvestment(id: string, patch: Partial<Investment>): Promise<void>;
  /** Apaga o investimento e as movimentações dele. */
  removeInvestment(id: string): Promise<void>;
  addInvestmentMovement(movement: InvestmentMovement): Promise<void>;
  updateInvestmentMovement(id: string, patch: Partial<InvestmentMovement>): Promise<void>;
  removeInvestmentMovement(id: string): Promise<void>;

  addExtraExpense(extra: ExtraExpense): Promise<void>;
  updateExtraExpense(id: string, patch: Partial<ExtraExpense>): Promise<void>;
  removeExtraExpense(id: string): Promise<void>;

  addCategory(category: CustomCategory): Promise<void>;
  /** Troca o nome e/ou a cor; com nome novo, os lançamentos que usavam o antigo passam para o novo. */
  updateCategory(id: string, patch: CategoryPatch): Promise<void>;
  removeCategory(id: string): Promise<void>;

  /** null volta ao padrão */
  setDistribution(items: DistributionItem[] | null): Promise<void>;
  /** Percentuais próprios de uma distribuição (Dist 2 em diante) de um mês; null volta ao padrão. */
  setDistributionOverride(month: string, group: number, items: DistributionItem[] | null): Promise<void>;

  /** Lista completa dos avisos de meta marcados como vistos. */
  setSeenAlerts(keys: string[]): Promise<void>;

  /** Grava a resposta ao tour de uma tela, sem mexer nas outras. */
  setOnboarding(screen: string, state: OnboardingState): Promise<void>;
}
