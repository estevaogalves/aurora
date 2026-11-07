import { useRef } from "react";
import { FaTrash } from "react-icons/fa6";
import { PiPushPinDuotone } from "react-icons/pi";
import { centsToInput, formatBRL, parseBRL, sanitizeAmountInput } from "../../../lib/money";
import type { Transaction } from "../../../Store/FinanceStore";

interface Props {
  expense: Transaction;

  editingAmount: string | null;
  tempAmount: string;

  setEditingAmount: (id: string | null) => void;
  setTempAmount: (value: string) => void;

  /** value em centavos */
  onUpdateAmount: (id: string, value: number) => void;
  onToggleFixed: (id: string) => void;

  onDelete: (id: string) => void;
}

export default function Actions({
  expense,
  editingAmount,
  tempAmount,
  setEditingAmount,
  setTempAmount,
  onUpdateAmount,
  onToggleFixed,
  onDelete,
}: Props) {
  const isEditing = editingAmount === expense.id;
  // Esc cancela: o blur que vem junto não pode salvar o texto descartado
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }

    const cents = parseBRL(tempAmount);
    // texto vazio ou inválido: mantém o valor que já estava
    if (cents !== null && cents !== expense.amount) {
      onUpdateAmount(expense.id, cents);
    }
    setEditingAmount(null);
  };

  return (
    <div className="flex items-center gap-4">
      
      {/* VALOR */}
      {isEditing ? (
        <div className="flex items-center border-2 text-white bg-slate-900 border-emerald-600 rounded-lg px-3 py-2">
          <span className="mr-1">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={tempAmount}
            autoFocus
            onChange={(e) => setTempAmount(sanitizeAmountInput(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                cancelled.current = true;
                setEditingAmount(null);
              }
            }}
            className="bg-transparent outline-none w-24"
          />
        </div>
      ) : (
        <span
          onClick={() => {
            setEditingAmount(expense.id);
            setTempAmount(centsToInput(expense.amount));
          }}
          className="font-bold text-lg text-white cursor-pointer"
        >
          {formatBRL(expense.amount)}
        </span>
      )}

      {/* FIXAR */}
      <button
        onClick={() => onToggleFixed(expense.id)}
        className={`p-2 rounded-lg border ${
          expense.fixed
            ? "bg-emerald-900 border-emerald-400"
            : "hover:bg-emerald-900 hover:border-emerald-400"
        }`}
      >
        <PiPushPinDuotone
          className={expense.fixed ? "text-emerald-400" : "text-white"}
        />
      </button>

      {/* REMOVER (fixa: oculta só neste mês) */}
      <button
        onClick={() => onDelete(expense.id)}
        title={expense.fixed ? "Ocultar neste mês" : "Remover"}
        className="p-2 rounded-lg border hover:bg-red-900 hover:border-red-400"
      >
        <FaTrash className="text-white" />
      </button>
    </div>
  );
}
