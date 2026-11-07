import { useState } from "react";
import ConfirmDeletion from "../../components/shared/ConfirmDeletion";
import { Card } from "../../components/ui/card";
import { formatBRL } from "../../lib/money";
import type { Transaction } from "../../Store/FinanceStore";
import { useFinanceStore } from "../../Store/FinanceStore";
import { useHiddenTransactions, useMonthCredit } from "../../Store/selectors";
import type { Category } from "../../Types/Category";
import { showToast } from "../Warnings/ToastContainer";
import ExpenseCard from "./Components/ExpenseCard";
import ExpenseCreditCard from "./Components/ExpenseCreditCard";

interface ExpensesListProps {
  expenses: Transaction[];
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
  } = useFinanceStore();

  const currentMonth = useFinanceStore(
    (state) => state.currentMonth
  );

  const creditExpenses = useMonthCredit();

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
  const hiddenTransactions = useHiddenTransactions().filter(
    (t) => t.type === "expense"
  );

  const deletingFixed =
    deleteType === "transaction" &&
    !!expenses.find((e) => e.id === expenseToDelete)?.fixed;

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
      <ConfirmDeletion
        open={showWarning && !!expenseToDelete}
        itemLabel={deletingFixed ? "despesa fixa" : "despesa"}
        hideOnly={deletingFixed}
        onCancel={() => {
          setShowWarning(false);
          setExpenseToDelete(null);
          setDeleteType(null);
        }}
        onConfirm={handleConfirmDelete}
      />

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
          <h2 className="text-muted-foreground text-sm">Transações ocultas</h2>

          {hiddenTransactions.map((expense) => (
            <Card key={expense.id} className="opacity-70">
              <div className="flex justify-between p-4">
                <div>
                  <h2 className="text-foreground">{expense.name}</h2>
                  <p className="text-muted-foreground">
                    {formatBRL(
                      expense.monthlyValues?.[currentMonth] ?? expense.amount
                    )}
                  </p>
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