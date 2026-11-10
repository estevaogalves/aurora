import { toCents } from "../lib/money";
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
  Transaction,
} from "../domain/types";

/** Versão atual do formato salvo. Aumente ao mudar o formato e trate em `migrateStored`. */
export const CURRENT_VERSION = 7;

/** Onde os dados vivem hoje. */
export const STORAGE_KEY = "aurora:finance";

/** Onde viviam antes (Zustand persist). Nunca é apagado: serve de backup. */
export const LEGACY_STORAGE_KEY = "finance-storage";

export interface StoredEnvelope {
  version: number;
  data: FinanceData;
}

export const emptyData = (): FinanceData => ({
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
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Valor antigo em reais (pode ser lixo, como NaN) para centavos. */
function reaisToCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? toCents(n) : 0;
}

/**
 * Formato antigo: Zustand persist com `{ state: {...}, version: 0 }`
 * e valores em REAIS (float). Converte tudo para centavos inteiros.
 */
export function migrateLegacy(raw: unknown): FinanceData | null {
  if (!isRecord(raw) || !isRecord(raw.state)) return null;
  const state = raw.state;

  const transactions = asArray<Transaction>(state.transactions).map((t) => ({
    ...t,
    amount: reaisToCents(t.amount),
    monthlyValues: t.monthlyValues
      ? Object.fromEntries(
          Object.entries(t.monthlyValues).map(([month, v]) => [month, reaisToCents(v)]),
        )
      : undefined,
  }));

  const creditTransactions = asArray<CreditTransaction>(state.creditTransactions).map(
    (c) => ({ ...c, totalAmount: reaisToCents(c.totalAmount) }),
  );

  const notes = asArray<Note>(state.notes);

  return { transactions, creditTransactions, creditCards: [], notes, goals: [], extraExpenses: [], customCategories: [], distribution: null, seenAlerts: [], onboarding: {} };
}

/** Só aceita respostas válidas; qualquer outra coisa é ignorada. */
export function parseOnboarding(raw: unknown): Record<string, OnboardingState> {
  if (!isRecord(raw)) return {};
  const out: Record<string, OnboardingState> = {};
  for (const [screen, state] of Object.entries(raw)) {
    if (state === "done" || state === "dismissed") out[screen] = state;
  }
  return out;
}

/** Lê o formato atual. Devolve null se o texto não for um envelope válido. */
export function migrateStored(raw: unknown): FinanceData | null {
  if (!isRecord(raw) || typeof raw.version !== "number" || !isRecord(raw.data)) {
    return null;
  }

  // v1 -> v2: entram `goals` e `extraExpenses`; v2 -> v3: `customCategories`; v3 -> v4: `distribution`; v4 -> v5: `seenAlerts`; v5 -> v6: `onboarding`; v6 -> v7: `creditCards`.
  // Quem não tem esses campos recebe listas vazias abaixo.
  if (raw.version > CURRENT_VERSION) return null;

  return {
    transactions: asArray<Transaction>(raw.data.transactions),
    creditTransactions: asArray<CreditTransaction>(raw.data.creditTransactions),
    creditCards: asArray<CreditCard>(raw.data.creditCards),
    notes: asArray<Note>(raw.data.notes),
    goals: asArray<Goal>(raw.data.goals),
    extraExpenses: asArray<ExtraExpense>(raw.data.extraExpenses),
    customCategories: asArray<CustomCategory>(raw.data.customCategories),
    distribution: Array.isArray(raw.data.distribution) ? (raw.data.distribution as DistributionItem[]) : null,
    seenAlerts: asArray<string>(raw.data.seenAlerts).filter((k) => typeof k === "string"),
    onboarding: parseOnboarding(raw.data.onboarding),
  };
}

/** Lê o texto salvo, devolvendo null se estiver vazio ou corrompido. */
export function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
