import type { Category } from "../Types/Category";

/** Mês no formato "YYYY-MM". */
export type Month = string;

/**
 * Todos os valores em dinheiro são CENTAVOS inteiros.
 * Veja src/lib/money.ts.
 */
/** Forma de pagamento de uma despesa. */
export type PaymentMethod = "pix" | "debit" | "credit" | "boleto";

/** Despesa paga: só registro para consulta e relatórios, não entra em nenhuma conta. */
export interface Payment {
  method: PaymentMethod;
  /** dia do pagamento, "YYYY-MM-DD" */
  date: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  name: string;
  /** centavos */
  amount: number;
  type: "income" | "expense";
  category: Category;
  notes?: string;
  /** Fixa: repete todo mês a partir de `month`. */
  fixed?: boolean;
  /** Mês em que foi lançada (e, para fixas, o primeiro mês em que vale). */
  month: Month;
  /** Fixas: meses em que foi ocultada. */
  hiddenMonths?: Month[];
  /** Fixas: valor (em centavos) específico de um mês. */
  monthlyValues?: Record<Month, number>;
  /** Despesas: pagamento por mês (fixa pode estar paga em um mês e não em outro). Só registro. */
  payments?: Record<Month, Payment>;
}

/** Parcela adiantada: o valor com desconto é cobrado em `month` (o mês de hoje no momento do adiantamento). */
export interface InstallmentAdvance {
  month: Month;
  /** centavos de desconto dado pelo banco */
  discount: number;
  /** centavos cobrados em `month` (valor da parcela menos o desconto) */
  amount: number;
}

export interface InstallmentAdjustment {
  /** centavos: valor só desta parcela, no lugar da divisão do total */
  value?: number;
  /** só esta parcela foi excluída */
  removed?: boolean;
  advanced?: InstallmentAdvance;
}

export interface CreditTransaction {
  id: string;
  name: string;
  /** centavos */
  totalAmount: number;
  installments: number;
  startMonth: Month;
  category: Category;
  /** Ajustes por parcela, pela posição ("1" a "N"): valor próprio, excluída ou adiantada. Ausente = nenhum. */
  adjustments?: Record<string, InstallmentAdjustment>;
  /**
   * Compra recorrente (assinatura no cartão): `totalAmount` é o valor cobrado todo mês a partir de
   * `startMonth`, sem divisão em parcelas (`installments` fica em 1).
   */
  recurring?: boolean;
  /** Recorrente cancelada: último mês cobrado. Ausente = segue cobrando. */
  endMonth?: Month;
}

export interface Note {
  id: string;
  content: string;
  date: string;
  pinned: boolean;
  month: Month;
}

/** Parcela de uma compra no crédito em um mês específico. */
export interface CreditInstallment {
  id: string;
  name: string;
  category: Category;
  installments: number;
  currentInstallment: number;
  /** centavos da parcela deste mês */
  installmentValue: number;
  /** centavos do total da compra */
  totalAmount: number;
  /** parcela com valor ajustado só para ela */
  adjusted?: boolean;
  /** cobrança de uma compra recorrente: `installments` é 0 e `currentInstallment` conta os meses desde o início */
  recurring?: boolean;
  /** parcela adiantada: cobrada neste mês, com o mês original e o desconto */
  advanced?: { originalMonth: Month; discount: number; originalValue: number };
}

/** Despesa planejada para um mês específico (tela de Projeção). */
export interface ExtraExpense {
  id: string;
  name: string;
  /** centavos */
  amount: number;
  month: Month;
  /** Pagamento da despesa (só registro). */
  payment?: Payment;
}

/** Categoria criada pelo usuário, com cor própria (hex, ex.: "#FF8800"). */
export interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

/** Meta de economia. Valores em centavos. */
export interface Goal {
  id: string;
  name: string;
  /** centavos: quanto quer juntar */
  target: number;
  /** centavos: quanto já guardou */
  saved: number;
  /** centavos: quanto pretende guardar por mês (0 = sem previsão) */
  monthly: number;
  /** Mês em que quer concluir, ou null. */
  deadline: Month | null;
  /** centavos: soma dos rendimentos registrados (já incluídos em `saved`). Ausente = 0. */
  yieldTotal?: number;
  /** Porquinho: guardado sem valor de meta (`target` fica em 0). Aparece abaixo das metas principais. */
  piggy?: boolean;
}

/** Uma fatia da sugestão de distribuição do saldo. */
export interface DistributionItem {
  id: string;
  label: string;
  /** percentual inteiro, 0 a 100 */
  percent: number;
  /** criada pelo usuário (as cinco padrão não podem ser apagadas) */
  custom?: boolean;
}

/** Resposta ao tour de uma tela: viu até o fim (done) ou recusou, fechou ou pulou (dismissed). */
export type OnboardingState = "done" | "dismissed";

/** Tudo o que o app guarda. É o que o repositório carrega e salva. */
export interface FinanceData {
  transactions: Transaction[];
  creditTransactions: CreditTransaction[];
  notes: Note[];
  goals: Goal[];
  extraExpenses: ExtraExpense[];
  customCategories: CustomCategory[];
  /** Percentuais escolhidos pelo usuário; null = padrão. */
  distribution: DistributionItem[] | null;
  /** Avisos de prazo de metas que o usuário já marcou como vistos (veja `goalAlertKey`). */
  seenAlerts: string[];
  /** Resposta ao tour de cada tela, por id da tela. Tela ausente = ainda não convidada. */
  onboarding: Record<string, OnboardingState>;
}

export interface MonthSummary {
  month: Month;
  /** centavos */
  totalIncome: number;
  /** centavos: despesas diretas + parcelas do crédito */
  totalExpense: number;
  /** centavos: só a parte do crédito, já somada em totalExpense */
  creditExpense: number;
  /** centavos: despesas extras planejadas para o mês, já somadas em totalExpense */
  extraExpense: number;
  balance: number;
  /** 0 a 100+ (despesas / renda). 0 se não há renda. */
  expensePercentage: number;
  /** centavos por categoria (crédito entra em "Crédito/Parcelado") */
  byCategory: Partial<Record<Category, number>>;
}

export interface ProjectionMonth {
  month: Month;
  income: number;
  /** despesas fixas + variáveis do mês-base + parcelas + extras */
  expense: number;
  creditExpense: number;
  extraExpense: number;
  balance: number;
  /** saldo acumulado até este mês, inclusive */
  accumulated: number;
}
