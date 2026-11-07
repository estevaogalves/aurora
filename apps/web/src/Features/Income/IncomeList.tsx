import { useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { PiPushPinDuotone, PiPushPinSlashFill } from "react-icons/pi";
import { formatBRL } from "../../lib/money";
import { useFinanceStore } from "../../Store/FinanceStore";
import { useHiddenTransactions, useMonthTransactions } from "../../Store/selectors";
import { showToast } from "../Warnings/ToastContainer";
import IncomeCard from "./IncomeCard";

interface ConfirmDeletionProps {
  onCloseWarning: () => void;
  onConfirm: () => void;
  /** Fixa só some neste mês e pode ser restaurada. */
  hideOnly?: boolean;
}

function ConfirmDeletion({
  onCloseWarning,
  onConfirm,
  hideOnly,
}: ConfirmDeletionProps) {
  return (
    <div className="flex items-center justify-center fixed inset-0 backdrop-blur-sm bg-black/90 z-50">
      <div className="bg-slate-900 border border-slate-600 rounded-3xl shadow-2xl w-[520px] overflow-hidden">
        {/* Barra superior */}
        <div className="bg-gray-700 flex items-center gap-3 px-6 py-3">
          <FaExclamationTriangle className="text-white" size={20} />
          <h1 className="text-white text-xl font-bold">Confirmar exclusão</h1>
        </div>

        {/* Conteúdo */}
        <div className="p-6 flex flex-col gap-4">
          <h2 className="text-gray-200 text-lg font-serif">
            {hideOnly
              ? "Esta renda fixa será ocultada apenas neste mês e poderá ser restaurada. Deseja continuar?"
              : "Este item será removido permanentemente. Realmente deseja prosseguir?"}
          </h2>

          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={onCloseWarning}
              className="bg-zinc-500 hover:bg-zinc-500 transition-colors duration-200 text-white px-4 py-2 rounded-xl font-medium shadow-md"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="bg-red-700 hover:bg-red-600 transition-colors duration-200 text-white px-4 py-2 rounded-xl font-medium shadow-md"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      {showWarning && incomeToDelete && (
        <ConfirmDeletion
          onCloseWarning={() => {
            setShowWarning(false);
            setIncomeToDelete(null);
          }}
          onConfirm={() => {
            if (!incomeToDelete) return;
            handleRemove(incomeToDelete);
            setShowWarning(false);
            setIncomeToDelete(null);
          }}
          hideOnly={!!incomes.find((i) => i.id === incomeToDelete)?.fixed}
        />
      )}

      {fixedIncomes.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-emerald-500 font-bold text-lg">
            <div className="flex justify-between border-emerald-700 bg-emerald-950/50 rounded-xl p-2">
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
          <h2 className="text-slate-300 font-bold text-lg">
            <div className="flex justify-between bg-slate-700/20 rounded-xl p-2">
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
          <h2 className="text-gray-400 text-sm">Rendas ocultas neste mês</h2>

          {hiddenIncomes.map((income) => (
            <div
              key={income.id}
              className="flex items-center justify-between rounded-xl border border-slate-600 bg-slate-900 p-4 opacity-70"
            >
              <div>
                <h2 className="text-white font-bold">{income.name}</h2>
                <p className="text-gray-400">
                  {formatBRL(income.monthlyValues?.[currentMonth] ?? income.amount)}
                </p>
              </div>

              <button
                onClick={() => restoreTransactionByMonth(income.id, currentMonth)}
                className="text-emerald-400 font-medium"
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
