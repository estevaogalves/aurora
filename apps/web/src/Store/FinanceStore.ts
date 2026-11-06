import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category } from "../Types/Category";
import { getCurrentMonth } from "../Utils/Date";

export interface Note {
  id: string;
  content: string;
  date: string;
  pinned: boolean;
  month: string;
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  category: Category;
  notes?: string;
  fixed?: boolean;
  month: string;
  hiddenMonths?: string[];
  monthlyValues?: Record<string, number>;
}

export interface CreditTransaction {
  id: string;
  name: string;
  totalAmount: number;
  installments: number;
  startMonth: string;
  category: Category;
}

interface FinanceState {
  currentMonth: string;
  setCurrentMonth: (month: string) => void;

  transactions: Transaction[];
  notes: Note[];
  creditTransactions: CreditTransaction[];

  addTransaction: (transaction: Transaction) => void;
  addCreditTransaction: (credit: CreditTransaction) => void;

  getCreditTransactionsByMonth: (month: string) => {
    id: string;
    name: string;
    category: Category;
    installments: number;
    currentInstallment: number;
    installmentValue: number;
    totalAmount: number;
  }[];
  removeTransaction: (id: string) => void;
  updateTransactionAmount: (id: string, amount: number) => void;
  updateTransactionAmountForMonth: (
    id: string,
    month: string,
    amount: number,
  ) => void;
  getHiddenTransactionsByMonth: (month: string) => Transaction[];
  restoreTransactionByMonth: (id: string, month: string) => void;

  updateTransactionCategory: (id: string, newName: Category) => void;
  updateTransactionName: (id: string, name: string) => void;
  toggleTransactionFixed: (id: string) => void;

  addNote: (note: Note) => void;
  removeNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  updateNote: (id: string, content: string) => void;
  getNotesByMonth: (month: string) => Note[];

  getTransactionsByMonth: (month: string) => Transaction[];
  removeTransactionByMonth: (id: string, month: string) => void;
  removeCreditTransaction: (id: string) => void

  getTotals: () => {
    totalIncome: number;
    totalExpense: number;
    balance: number;
  };

  getExpensePercentage: () => number;

  getDistribuition: () => {
    emergency: number;
    invest: number;
    leisure: number;
    education: number;
    costs: number;
  };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      currentMonth: getCurrentMonth(),

      setCurrentMonth: (month) => set({ currentMonth: month }),

      transactions: [],
      notes: [],
      creditTransactions: [],

      addCreditTransaction: (credit) =>
        set((state) => ({
          creditTransactions: [...state.creditTransactions, credit],
        })),

      getCreditTransactionsByMonth: (month: string) => {
        const { creditTransactions } = get();

        const [year, monthIndex] = month.split("-").map(Number);
        const current = new Date(year, monthIndex - 1);

        return creditTransactions
          .filter((credit) => {
            const [startYear, startMonth] = credit.startMonth
              .split("-")
              .map(Number);

            const start = new Date(startYear, startMonth - 1);

            const diffMonths =
              (current.getFullYear() - start.getFullYear()) * 12 +
              (current.getMonth() - start.getMonth());

            return diffMonths >= 0 && diffMonths < credit.installments;
          })
          .map((credit) => {
            const [startYear, startMonth] = credit.startMonth
              .split("-")
              .map(Number);

            const start = new Date(startYear, startMonth - 1);

            const diffMonths =
              (current.getFullYear() - start.getFullYear()) * 12 +
              (current.getMonth() - start.getMonth());

            return {
              id: credit.id,
              name: credit.name,
              category: credit.category,
              installments: credit.installments,
              currentInstallment: diffMonths + 1,
              installmentValue: credit.totalAmount / credit.installments,
              totalAmount: credit.totalAmount,
            };
          });
      },

      removeCreditTransaction: (id: string) =>
        set((state) => ({
          creditTransactions: state.creditTransactions.filter(
            (c) => c.id !== id,
          ),
        })),

      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [...state.transactions, transaction],
        })),

      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      updateTransactionAmount: (id, amount) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, amount } : t,
          ),
        })),

      updateTransactionAmountForMonth: (id, month, amount) =>
        set((state) => ({
          transactions: state.transactions.map((t) => {
            if (t.id !== id) return t;

            if (t.fixed) {
              return {
                ...t,
                monthlyValues: {
                  ...t.monthlyValues,
                  [month]: amount,
                },
              };
            }

            return { ...t, amount };
          }),
        })),

      updateTransactionName: (id, name) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, name } : t,
          ),
        })),

      updateTransactionCategory: (id: string, newCategory: Category) =>
        set((state) => {
          console.log("id recebido: ", id);
          console.log("ANTES", state.transactions);

          const updated = state.transactions.map((t) =>
            t.id === id ? { ...t, category: newCategory } : t,
          );

          console.log("DEPOIS", updated);

          return {
            transactions: updated,
          };
        }),

      toggleTransactionFixed: (id) =>
        set((state) => ({
          transactions: state.transactions.map((t) => {
            if (t.id !== id) return t;

            // Se estiver fixando uma transação que não era fixa
            if (!t.fixed) {
              return {
                ...t,
                fixed: true,
                // Garante que não está oculta em nenhum mês
                hiddenMonths: [],
                // Mantém o mês original
                month: t.month,
              };
            }

            // Se estiver desfixando
            return {
              ...t,
              fixed: false,
              // Limpa dados específicos de fixa
              hiddenMonths: undefined,
              monthlyValues: undefined,
            };
          }),
        })),

      addNote: (note) =>
        set((state) => ({
          notes: [...state.notes, note],
        })),

      removeNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        })),

      togglePinNote: (id) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned } : n,
          ),
        })),

      updateNote: (id, content) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, content } : n)),
        })),

      getNotesByMonth: (month) => {
        const { notes } = get();
        return notes.filter((n) => n.month === month);
      },

      getTransactionsByMonth: (month) => {
        const { transactions } = get();

        return transactions
          .filter((t) => {
            if (t.fixed) {
              return !t.hiddenMonths?.includes(month);
            }
            return t.month === month;
          })
          .map((t) => {
            if (t.fixed && t.monthlyValues?.[month]) {
              return {
                ...t,
                amount: t.monthlyValues[month],
              };
            }
            return t;
          });
      },

      removeTransactionByMonth: (id, month) =>
        set((state) => ({
          transactions: state.transactions
            .map((t) => {
              if (t.id !== id) return t;

              if (t.fixed) {
                return {
                  ...t,
                  hiddenMonths: [...(t.hiddenMonths || []), month],
                };
              }

              return null;
            })
            .filter(Boolean) as Transaction[],
        })),

      getTotals: () => {
        const { currentMonth } = get();
        const transactions = get().getTransactionsByMonth(currentMonth);

        const totals = transactions.reduce(
          (acc, transaction) => {
            if (transaction.type === "income") {
              acc.income += transaction.amount;
            } else {
              acc.expense += transaction.amount;
            }

            return acc;
          },
          { income: 0, expense: 0 },
        );

        return {
          totalIncome: totals.income,
          totalExpense: totals.expense,
          balance: totals.income - totals.expense,
        };
      },

      getHiddenTransactionsByMonth: (month) => {
        const { transactions } = get();

        return transactions.filter(
          (t) => t.fixed && t.hiddenMonths?.includes(month),
        );
      },

      restoreTransactionByMonth: (id, month) =>
        set((state) => ({
          transactions: state.transactions.map((t) => {
            if (t.id !== id) return t;

            if (t.fixed) {
              return {
                ...t,
                hiddenMonths: t.hiddenMonths?.filter((m) => m !== month),
              };
            }

            return t;
          }),
        })),

      getExpensePercentage: () => {
        const { totalExpense, totalIncome } = get().getTotals();

        if (totalIncome === 0) return 0;

        return (totalExpense / totalIncome) * 100;
      },

      getDistribuition: () => {
        const { balance } = get().getTotals();

        if (balance <= 0) {
          return {
            emergency: 0,
            invest: 0,
            leisure: 0,
            education: 0,
            costs: 0,
          };
        }

        return {
          emergency: balance * 0.3,
          invest: balance * 0.2,
          leisure: balance * 0.2,
          education: balance * 0.15,
          costs: balance * 0.15,
        };
      },
    }),
    {
      name: "finance-storage",
      partialize: (state) => ({
        transactions: state.transactions,
        notes: state.notes,
        currentMonth: state.currentMonth,
        creditTransactions: state.creditTransactions,
      }),
    },
  ),
);
