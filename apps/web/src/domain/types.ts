import type { Category } from "../Types/Category";

/** Mês no formato "YYYY-MM". */
export type Month = string;

/**
 * Todos os valores em dinheiro são CENTAVOS inteiros.
 * Veja src/lib/money.ts.
 */
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
}

export interface CreditTransaction {
  id: string;
  name: string;
  /** centavos */
  totalAmount: number;
  installments: number;
  startMonth: Month;
  category: Category;
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
}

/** Despesa planejada para um mês específico (tela de Projeção). */
export interface ExtraExpense {
  id: string;
  name: string;
  /** centavos */
  amount: number;
  month: Month;
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
}

export interface MonthSummary {
  month: Month;
  /** centavos */
  totalIncome: number;
  /** centavos: despesas diretas + parcelas do crédito */
  totalExpense: number;
  /** centavos: só a parte do crédito, já somada em totalExpense */
  creditExpense: number;
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
