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
  /** Fixas encerradas: último mês em que vale (o seguinte em diante não vale mais). Ausente = segue valendo. */
  endMonth?: Month;
  /** Fixas: valor (em centavos) específico de um mês. */
  monthlyValues?: Record<Month, number>;
  /** Fixas: observação de um mês. A observação é só do mês: `notes` vale apenas no mês de criação e não se repete nos seguintes. */
  monthlyNotes?: Record<Month, string>;
  /**
   * Valor variável (estimado), em fixa ou avulsa: `amount` é uma estimativa. Na fixa, o valor real de um mês é o seu
   * `monthlyValues`; na avulsa (renda ou despesa de um mês só), o valor real vem de editar `amount` e desmarcar a estimativa.
   */
  variableAmount?: boolean;
  /** Só em `getTransactionsByMonth` (não é salvo): valor variável deste mês ainda sem o valor real (fixa sem `monthlyValues`, ou avulsa estimada). */
  estimated?: boolean;
  /** Despesas: pagamento por mês (fixa pode estar paga em um mês e não em outro). Só registro. */
  payments?: Record<Month, Payment>;
  /**
   * Despesa avulsa paga no cartão. Com `cardId` e `purchaseDate`, o valor entra no mês do vencimento da
   * fatura (veja `resolveCardExpenses`); `month` e `purchaseDate` ficam como foram lançados. Só despesas
   * avulsas: fixa não tem cartão. Ausente = despesa comum, no próprio mês.
   */
  cardId?: string;
  /** Dia da compra no cartão, "YYYY-MM-DD". Vem junto com `cardId`. */
  purchaseDate?: string;
  /**
   * Renda variável (13º salário, bônus): em qual distribuição da sugestão do saldo ela entra. Ausente = soma ao saldo
   * do mês (Dist 1); de 2 a 20 = distribuição própria (Dist 2, 3...), cada uma com a sua página e os seus percentuais
   * no Painel. Só marca: não muda nenhum valor. Só renda não fixa.
   */
  distGroup?: number;
  /**
   * Despesas: dia do vencimento (1 a 31), para o card "Próximos vencimentos" do Painel. Ausente = sem dia (a despesa
   * não aparece lá). Em despesa fixa vale para todos os meses; em meses curtos, o dia vira o último dia do mês.
   * Só marca: não muda nenhum valor.
   */
  dueDay?: number;
  /** Etiquetas livres (ex.: "viagem"), para buscar e filtrar em Lançamentos. Só marcas: não mudam valor nenhum. */
  tags?: string[];
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
  /** Dia da cobrança (1 a 31), tirado da data de início escolhida. Ausente = não informado. */
  billingDay?: number;
  /** Cartão da compra. Com cartão, o valor entra no mês do vencimento da fatura. Ausente = mês da cobrança. */
  cardId?: string;
  /** Recorrente de valor variável: `totalAmount` é uma estimativa; cada mês pode ter o valor real (`adjustments[n].value`). */
  variableAmount?: boolean;
}

/** Cartão de crédito: só nome e dias de fechamento e vencimento (1 a 31). Nada sensível. */
export interface CreditCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  /** Teto mensal da fatura, em centavos. Ausente = sem teto. Só acompanhamento: não bloqueia nada. */
  limit?: number;
  /** Pagamento da fatura por mês de vencimento ("2026-12"). Só registro, não entra em nenhuma conta. */
  payments?: Record<Month, Payment>;
  /** Ajustes da fatura (descontos e acréscimos) por mês de vencimento, vários por fatura. Só registro: não entram em nenhuma despesa. */
  adjustments?: Record<Month, InvoiceAdjustment[]>;
}

/** Um ajuste de uma fatura para ela bater com a do banco. `amount` em centavos: negativo = desconto, positivo = acréscimo. */
export interface InvoiceAdjustment {
  /** identifica o ajuste dentro da fatura */
  id: string;
  amount: number;
  note?: string;
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
  /** parcela com valor ajustado só para ela (em recorrente variável: o valor real do mês) */
  adjusted?: boolean;
  /** recorrente de valor variável ainda sem o valor real deste mês: o valor é uma estimativa */
  estimated?: boolean;
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
  /** Cartão e dia da compra: igual a `Transaction.cardId` e `Transaction.purchaseDate`. */
  cardId?: string;
  purchaseDate?: string;
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

/**
 * Histórico de metas e porquinhos, no mesmo conceito dos investimentos: o guardado é refeito pelas movimentações.
 * Aporte soma; retirada subtrai (nunca abaixo de zero); rendimento soma ao guardado e ao total de rendimentos;
 * ajuste define o novo guardado (`amount` é o valor, não a diferença).
 */
export type GoalMovementType = "contribution" | "withdrawal" | "yield" | "adjustment";

export interface GoalMovement {
  id: string;
  goalId: string;
  type: GoalMovementType;
  /** "AAAA-MM-DD" */
  date: string;
  /** centavos */
  amount: number;
  /** observação livre (até 200 letras) */
  note?: string;
  /** vazio = lançado à mão; "distribution|AAAA-MM|fonte|fatia" = enviado pela sugestão do saldo (veja `parseDistributionOrigin`) */
  origin?: string;
}

/**
 * Família de investimento: define quais campos o cadastro pede. "business" é o negócio próprio (revenda, por
 * exemplo): aporte = dinheiro investido, recebimento = venda que entrou, resgate = saque feito para você.
 */
export type InvestmentFamily = "fixed" | "treasury" | "liquid" | "equity" | "fund" | "other" | "business";

/** Investimento registrado à mão. Valores em centavos; datas "YYYY-MM-DD". Não entra em receitas, despesas nem saldo. */
export interface Investment {
  id: string;
  name: string;
  family: InvestmentFamily;
  /** produto dentro da família (ex.: "CDB", "FII"), texto livre */
  product?: string;
  /** banco, corretora ou plataforma */
  institution: string;
  /** data da primeira aplicação */
  appliedAt: string;
  /** centavos: quanto vale hoje, atualizado pelo usuário (e pelas movimentações) */
  currentValue: number;
  /** vencimento (renda fixa e Tesouro) */
  maturityDate?: string;
  /** indexador, ex.: "CDI", "IPCA", "Pré", "Selic" */
  indexer?: string;
  /** taxa contratada, ex.: "110% do CDI" ou "IPCA + 6%" */
  rate?: string;
  /** liquidez, ex.: "Diária", "No vencimento", "D+30" */
  liquidity?: string;
  /** carência até esta data */
  graceUntil?: string;
  /** aceita resgate antes do vencimento */
  earlyRedeem?: boolean;
  /** cotas ou ativos (fracionário) */
  quantity?: number;
  /** centavos: preço médio por cota */
  avgPrice?: number;
  /** prazo de resgate em dias (fundos) */
  redeemDays?: number;
  ticker?: string;
  /** taxas e imposto estimados, texto livre */
  fees?: string;
  notes?: string;
}

/**
 * aporte e resgate mexem no dinheiro que entra e sai do investimento;
 * rendimento soma ao valor atual sem ser aporte;
 * ajuste define o novo valor atual (`amount` é o valor, não a diferença).
 * Só no negócio próprio: aporte é o investimento feito (não mexe no valor atual), "income" é o dinheiro recebido
 * das vendas (entra no saldo a sacar) e resgate é o saque (sai desse saldo).
 */
export type InvestmentMovementType = "contribution" | "redemption" | "yield" | "adjustment" | "income";

export interface InvestmentMovement {
  id: string;
  investmentId: string;
  type: InvestmentMovementType;
  date: string;
  /** centavos (valor total da movimentação) */
  amount: number;
  /** cotas ou ativos comprados (aporte) ou vendidos (resgate), quando o investimento controla quantidade */
  quantity?: number;
  /** centavos: preço por cota nesta movimentação */
  unitPrice?: number;
  /** observação livre (até 200 letras) */
  note?: string;
  /** vazio = lançado à mão; "distribution|AAAA-MM|fonte|fatia" = enviado pela sugestão do saldo */
  origin?: string;
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

/**
 * Orçamento por categoria: categoria -> mês -> limite mensal (centavos). Cada par é uma mudança de limite: o limite de
 * um mês é o da última mudança até ele (herda para os meses seguintes até o usuário mudar). 0 = sem limite desde o mês.
 */
export type Budgets = Record<string, Record<Month, number>>;

/** Dívida ou consórcio em parcelas fixas. Só um acompanhamento: não cria nem muda despesas. */
export interface Debt {
  id: string;
  name: string;
  /** centavos */
  installmentValue: number;
  totalInstallments: number;
  paidInstallments: number;
  /** mês da próxima parcela a pagar; a quitação é este mês + (restantes − 1) */
  nextMonth: Month;
  /** despesa fixa que já traz esta parcela no orçamento (para não somar duas vezes) */
  linkedTransactionId?: string;
  note?: string;
  /**
   * Valor realmente pago em cada parcela, por mês da parcela (centavos): para um desconto ou acréscimo daquele mês.
   * Parcela sem valor aqui vale o da despesa fixa vinculada naquele mês (se houver) ou o `installmentValue`.
   */
  paidValues?: Record<Month, number>;
}

/** Retrato de um mês fechado. */
export interface MonthClosing {
  /** "AAAA-MM-DD" */
  closedAt: string;
  income: number;
  expense: number;
  balance: number;
  byCategory: Record<string, number>;
  /** anotação de aprendizado do mês */
  note?: string;
}

/** Ativo da carteira manual de dividendos (sem integração com corretora). */
export interface DividendAsset {
  id: string;
  name: string;
  /** centavos */
  invested: number;
  /** proventos recebidos por mês (média), centavos */
  monthlyDividends: number;
}

/** Dados de um comprovante anexado (o conteúdo fica à parte e só sai ao baixar). */
export interface ReceiptMeta {
  id: string;
  transactionId: string;
  name: string;
  mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
  /** bytes */
  size: number;
  /** "AAAA-MM-DD" */
  createdAt: string;
}

/** O planejamento inteiro, como a API o guarda (`PUT /settings/planning`). */
export interface Planning {
  budgets: Budgets;
  debts: Debt[];
  closings: Record<Month, MonthClosing>;
  dividendAssets: DividendAsset[];
}

/** Tudo o que o app guarda. É o que o repositório carrega e salva. */
export interface FinanceData {
  transactions: Transaction[];
  creditTransactions: CreditTransaction[];
  /** Cartões cadastrados. Ausente = nenhum. */
  creditCards?: CreditCard[];
  notes: Note[];
  goals: Goal[];
  /** Histórico das metas e porquinhos (o guardado de cada um é refeito por ele). Ausente = nenhum. */
  goalMovements?: GoalMovement[];
  /** Investimentos e suas movimentações. Ausente = nenhum. */
  investments?: Investment[];
  investmentMovements?: InvestmentMovement[];
  extraExpenses: ExtraExpense[];
  customCategories: CustomCategory[];
  /** Percentuais escolhidos pelo usuário; null = padrão. */
  distribution: DistributionItem[] | null;
  /**
   * Percentuais próprios de uma distribuição (Dist 2 em diante) de um mês, por chave "AAAA-MM|n" (veja `overrideKey`).
   * Sem a chave, vale `distribution` (o padrão). A Dist 1 sempre usa o padrão. Ausente = nenhuma.
   */
  distributionOverrides?: Record<string, DistributionItem[]>;
  budgets?: Budgets;
  debts?: Debt[];
  closings?: Record<Month, MonthClosing>;
  dividendAssets?: DividendAsset[];
  /** comprovantes anexados (só os dados; o conteúdo é baixado à parte). Não entram em backup nem em importação. */
  receipts?: ReceiptMeta[];
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
  /** centavos: ajustes (descontos negativos, acréscimos positivos) das faturas que vencem no mês, já somados em totalExpense */
  invoiceAdjustment: number;
  balance: number;
  /** 0 a 100+ (despesas / renda). 0 se não há renda. */
  expensePercentage: number;
  /** centavos por categoria; parcelas e recorrências do crédito entram na categoria da própria compra */
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
