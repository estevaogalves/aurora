import { useState } from "react";
import ConfirmDeletion from "../../components/shared/ConfirmDeletion";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { PiPushPinDuotone, PiPushPinSlashFill } from "react-icons/pi";
import { formatBRL } from "../../lib/money";
import { useFinanceStore } from "../../Store/FinanceStore";
import { useHiddenTransactions, useMonthTransactions } from "../../Store/selectors";
import { showToast } from "../Warnings/ToastContainer";
import IncomeCard from "./IncomeCard";

export default function IncomeList() {
  const currentMonth = useFinanceStore((state) => state.currentMonth);
  const incomes = useMonthTransactions().filter((t) => t.type === "income");
  const hiddenIncomes = useHiddenTransactions().filter((t) => t.type === "income");

  const fixedIncomes = incomes.filter((i) => i.fixed);
  const variableIncomes = incomes.filter((i) => !i.fixed);
  const [openCardFixed, setOpenCardFixed] = useState(false);
  const [openCardVariable, setOpenCardVariable] = useState(false);

  const removeTransactionByMonth = useFinanceStore(
    (state) => state.removeTransactionByMonth,
  );
  const restoreTransactionByMonth = useFinanceStore(
    (state) => state.restoreTransactionByMonth,
  );
  const updateTransactionAmountForMonth = useFinanceStore(
    (state) => state.updateTransactionAmountForMonth,
  );
  const updateTransactionName = useFinanceStore(
    (state) => state.updateTransactionName,
  );
  const toggleTransactionFixed = useFinanceStore(
    (state) => state.toggleTransactionFixed,
  );

  const [showWarning, setShowWarning] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);

  const [editingAmount, setEditingAmount] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState("");

  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  const handleRemove = (incomeId: string) => {
    const income = incomes.find((i) => i.id === incomeId);

    // fixa: oculta só neste mês; comum: remove de vez
    removeTransactionByMonth(incomeId, currentMonth);

    showToast({
      type: "success",
      text: income?.fixed
        ? `Renda "${income.name}" ocultada neste mês`
        : `Renda "${income?.name}" removida`,
    });
  };

  /** newAmount em centavos */
  const handleUpdateAmount = (incomeId: string, newAmount: number) => {
    updateTransactionAmountForMonth(incomeId, currentMonth, newAmount);

    showToast({
      type: "success",
      text: "Valor da renda atualizado",
    });
  };

  const handleUpdateName = (incomeId: string, newName: string) => {
    if (!newName.trim()) return;

    updateTransactionName(incomeId, newName);

    showToast({
      type: "success",
      text: "Nome da renda atualizado",
    });
  };

  const handleToggleFixed = (incomeId: string) => {
    toggleTransactionFixed(incomeId);

    const income = incomes.find((e) => e.id === incomeId);

    showToast({
      type: "success",
      text: income?.fixed ? "Renda desfixada" : "Renda fixada",
    });
  };

  const sortedFixed = [...fixedIncomes].sort(
    (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  );

  const sortedVariable = [...variableIncomes].sort(
    (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  );

  return (
    <div className="grid gap-3">
      <ConfirmDeletion
        open={showWarning && !!incomeToDelete}
        itemLabel={incomes.find((i) => i.id === incomeToDelete)?.fixed ? "renda fixa" : "renda"}
        hideOnly={!!incomes.find((i) => i.id === incomeToDelete)?.fixed}
        onCancel={() => {
          setShowWarning(false);
          setIncomeToDelete(null);
        }}
        onConfirm={() => {
          if (!incomeToDelete) return;
          handleRemove(incomeToDelete);
          setShowWarning(false);
          setIncomeToDelete(null);
        }}
      />

      {fixedIncomes.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-success font-bold text-lg">
            <div className="flex justify-between border-primary bg-primary/10 rounded-xl p-2">
              <section className="flex items-center gap-3">
                <PiPushPinDuotone className="text-xl" />
                Rendas Fixas ({fixedIncomes.length})
              </section>
              <button onClick={() => setOpenCardFixed((prev) => !prev)} className="mr-3">
                {openCardFixed ? <IoIosArrowUp /> : <IoIosArrowDown />}
              </button>
            </div>
          </h2>

          {openCardFixed && (
            <>
              {sortedFixed.map((income) => (
                <IncomeCard
                  key={income.id}
                  income={income}
                  editingName={editingName}
                  tempName={tempName}
                  setEditingName={setEditingName}
                  setTempName={setTempName}
                  handleUpdateName={handleUpdateName}
                  editingAmount={editingAmount}
                  tempAmount={tempAmount}
                  setEditingAmount={setEditingAmount}
                  setTempAmount={setTempAmount}
                  handleUpdateAmount={handleUpdateAmount}
                  handleToggleFixed={handleToggleFixed}
                  setIncomeToDelete={setIncomeToDelete}
                  setShowWarning={setShowWarning}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* 🔹 RENDAS VARIÁVEIS */}
      {variableIncomes.length > 0 && (
        <div className="grid gap-3 mt-3">
          <h2 className="text-foreground/80 font-bold text-lg">
            <div className="flex justify-between bg-secondary rounded-xl p-2">
              <section className="flex items-center gap-3">
                <PiPushPinSlashFill className="text-xl" />
                Rendas deste mês ({variableIncomes.length})
              </section>
              <button onClick={() => setOpenCardVariable((prev) => !prev)} className="mr-3">
                {openCardVariable ? <IoIosArrowUp /> : <IoIosArrowDown />}
              </button>
            </div>
          </h2>

          {openCardVariable && (
            <>
              {sortedVariable.map((income) => (
                <IncomeCard
                  key={income.id}
                  income={income}
                  editingName={editingName}
                  tempName={tempName}
                  setEditingName={setEditingName}
                  setTempName={setTempName}
                  handleUpdateName={handleUpdateName}
                  editingAmount={editingAmount}
                  tempAmount={tempAmount}
                  setEditingAmount={setEditingAmount}
                  setTempAmount={setTempAmount}
                  handleUpdateAmount={handleUpdateAmount}
                  handleToggleFixed={handleToggleFixed}
                  setIncomeToDelete={setIncomeToDelete}
                  setShowWarning={setShowWarning}
                />
              ))}
            </>
          )}
        </div>
      )}

      {hiddenIncomes.length > 0 && (
        <div className="mt-3 space-y-3">
          <h2 className="text-muted-foreground text-sm">Rendas ocultas neste mês</h2>

          {hiddenIncomes.map((income) => (
            <div
              key={income.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 opacity-70"
            >
              <div>
                <h2 className="text-foreground font-bold">{income.name}</h2>
                <p className="text-muted-foreground">
                  {formatBRL(income.monthlyValues?.[currentMonth] ?? income.amount)}
                </p>
              </div>

              <button
                onClick={() => restoreTransactionByMonth(income.id, currentMonth)}
                className="text-success font-medium"
              >
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
