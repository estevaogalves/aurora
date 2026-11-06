import { useMemo, useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { Card } from "../../components/ui/card";
import type { CreditTransaction, Transaction } from "../../Store/FinanceStore";
import { useFinanceStore } from "../../Store/FinanceStore";
import type { Category } from "../../Types/Category";
import { showToast } from "../Warnings/ToastContainer";
import ExpenseCard from "./Components/ExpenseCard";
import ExpenseCreditCard from "./Components/ExpenseCreditCard";

interface ExpensesListProps {
  expenses: Transaction[];
}

interface ConfirmDeletionProps {
  onCloseWarning: () => void;
  onConfirm: () => void;
}

interface CreditItem {
  id: string;
  name: string;
  category: Category;
  installments: number;
  currentInstallment: number;
  installmentValue: number;
  totalAmount: number;
}

// -----------------------------
// FUNÇÃO PURA (fora do componente)
// -----------------------------
function getCreditTransactionsByMonth(
  creditTransactions: CreditTransaction[],
  month: string
): CreditItem[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const current = new Date(year, monthIndex - 1);

  return creditTransactions
    .map((credit) => {
      const [startYear, startMonth] = credit.startMonth.split("-").map(Number);
      const start = new Date(startYear, startMonth - 1);

      const diffMonths =
        (current.getFullYear() - start.getFullYear()) * 12 +
        (current.getMonth() - start.getMonth());

      if (diffMonths < 0 || diffMonths >= credit.installments) {
        return null;
      }

      return {
        id: credit.id,
        name: credit.name,
        category: credit.category,
        installments: credit.installments,
        currentInstallment: diffMonths + 1,
        installmentValue: Number(
          (credit.totalAmount / credit.installments).toFixed(2)
        ),
        totalAmount: credit.totalAmount,
      };
    })
    .filter((item): item is CreditItem => item !== null);
}

function ConfirmDeletion({ onCloseWarning, onConfirm }: ConfirmDeletionProps) {
  return (
    <div className="flex items-center justify-center fixed inset-0 backdrop-blur-sm bg-black/90 z-50">
      <div className="bg-slate-900 border border-slate-600 rounded-3xl shadow-2xl w-[520px] overflow-hidden">
        <div className="bg-gray-700 flex items-center gap-3 px-6 py-3">
          <FaExclamationTriangle className="text-white" size={20} />
          <h1 className="text-white text-xl font-bold">Confirmar exclusão</h1>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <h2 className="text-gray-200 text-lg font-serif">
            Este item será removido permanentemente. Deseja continuar?
          </h2>

          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={onCloseWarning}
              className="bg-zinc-500 text-white px-4 py-2 rounded-xl"
            >
              Cancelar
            </button>

            <button
              onClick={onConfirm}
              className="bg-red-700 text-white px-4 py-2 rounded-xl"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesList({ expenses }: ExpensesListProps) {
  const {
    removeTransactionByMonth,
    updateTransactionAmountForMonth,
    updateTransactionName,
    updateTransactionCategory,
    toggleTransactionFixed,
    restoreTransactionByMonth,
    removeCreditTransaction,
    transactions,
  } = useFinanceStore();

  // ✅ Zustand (estado puro)
  const creditTransactions = useFinanceStore(
    (state) => state.creditTransactions
  );

  const currentMonth = useFinanceStore(
    (state) => state.currentMonth
  );

  // ✅ Derivado correto (SEM loop)
  const creditExpenses = useMemo(() => {
    return getCreditTransactionsByMonth(
      creditTransactions,
      currentMonth
    );
  }, [creditTransactions, currentMonth]);

  // -----------------------------
  // STATES
  // -----------------------------
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<
    "transaction" | "credit" | null
  >(null);
  const [showWarning, setShowWarning] = useState(false);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<Category | null>(null);

  const [editingAmount, setEditingAmount] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState<string>("");

  // -----------------------------
  // DERIVADOS
  // -----------------------------
  const hiddenTransactions = transactions.filter(
    (t) => t.fixed && t.hiddenMonths?.includes(currentMonth)
  );

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (a.fixed && !b.fixed) return -1;
    if (!a.fixed && b.fixed) return 1;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  // -----------------------------
  // HANDLERS
  // -----------------------------
  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;

    if (deleteType === "credit") {
      removeCreditTransaction(expenseToDelete);
    } else {
      removeTransactionByMonth(expenseToDelete, currentMonth);
    }

    setExpenseToDelete(null);
    setDeleteType(null);
    setShowWarning(false);
  };

  const handleUpdateAmount = (id: string, value: number) => {
    updateTransactionAmountForMonth(id, currentMonth, value);
    showToast({ type: "success", text: "Valor atualizado" });
  };

  const handleUpdateName = (id: string, name: string) => {
    if (!name.trim()) return;
    updateTransactionName(id, name);
  };

  const handleUpdateCategory = (id: string, category: Category) => {
    updateTransactionCategory(id, category);
  };

  const handleToggleFixed = (id: string) => {
    toggleTransactionFixed(id);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="w-full flex flex-col gap-3">
      {showWarning && expenseToDelete && (
        <ConfirmDeletion
          onCloseWarning={() => {
            setShowWarning(false);
            setExpenseToDelete(null);
            setDeleteType(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

      <ExpenseCreditCard
        expenses={creditExpenses}
        onDelete={(id) => {
          setExpenseToDelete(id);
          setDeleteType("credit");
          setShowWarning(true);
        }}
      />

      {sortedExpenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          editingName={editingName}
          tempName={tempName}
          editingCategory={editingCategory}
          tempCategory={tempCategory}
          editingAmount={editingAmount}
          tempAmount={tempAmount}
          setEditingName={setEditingName}
          setTempName={setTempName}
          setEditingCategory={setEditingCategory}
          setTempCategory={setTempCategory}
          setEditingAmount={setEditingAmount}
          setTempAmount={setTempAmount}
          onUpdateName={handleUpdateName}
          onUpdateCategory={handleUpdateCategory}
          onUpdateAmount={handleUpdateAmount}
          onToggleFixed={handleToggleFixed}
          onDelete={(id) => {
            setExpenseToDelete(id);
            setDeleteType("transaction");
            setShowWarning(true);
          }}
        />
      ))}

      {hiddenTransactions.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-gray-400 text-sm">Transações ocultas</h2>

          {hiddenTransactions.map((expense) => (
            <Card key={expense.id} className="opacity-70">
              <div className="flex justify-between p-4">
                <div>
                  <h2 className="text-white">{expense.name}</h2>
                  <p className="text-gray-400">R$ {expense.amount}</p>
                </div>

                <button
                  onClick={() =>
                    restoreTransactionByMonth(expense.id, currentMonth)
                  }
                >
                  Restaurar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}