import { useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { PiPushPinDuotone, PiPushPinSlashFill } from "react-icons/pi";
import { useFinanceStore } from "../../Store/FinanceStore";
import { showToast } from "../Warnings/ToastContainer";
import IncomeCard from "./IncomeCard";

interface ConfirmDeletionProps {
  onCloseWarning: () => void;
  onConfirm: () => void;
}

function ConfirmDeletion({ onCloseWarning, onConfirm }: ConfirmDeletionProps) {
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
            Este item será removido permanentemente. Realmente deseja
            prosseguir?
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
  const transactions = useFinanceStore((state) => state.transactions);
  const incomes = transactions.filter((t) => t.type === "income");

  const fixedIncomes = incomes.filter((i) => i.fixed);
  const variableIncomes = incomes.filter((i) => !i.fixed);
  const [openCardFixed, setOpenCardFixed] = useState(false);
  const [openCardVariable, setOpenCardVariable] = useState(false);

  const removeTransaction = useFinanceStore((state) => state.removeTransaction);
  const updateTransactionAmount = useFinanceStore(
    (state) => state.updateTransactionAmount,
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

    removeTransaction(incomeId);

    showToast({
      type: "success",
      text: `Renda "${income?.name}" removida`,
    });
  };

  const handleUpdateAmount = (incomeId: string, newAmount: number) => {
    updateTransactionAmount(incomeId, newAmount);

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

  // const sortedIncomes = [...incomes].sort((a, b) => {
  //   if (a.fixed && !b.fixed) return -1;
  //   if (!a.fixed && b.fixed) return 1;
  //   return (b.amount ?? 0) - (a.amount ?? 0);
  // });

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
            null;
          }}
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
    </div>
  );
}
