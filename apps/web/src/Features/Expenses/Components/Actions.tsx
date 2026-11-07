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
        <div className="flex items-center border-2 text-foreground bg-card border-primary rounded-lg px-3 py-2">
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
          className="font-bold text-lg text-foreground cursor-pointer"
        >
          {formatBRL(expense.amount)}
        </span>
      )}

      {/* FIXAR */}
      <button
        onClick={() => onToggleFixed(expense.id)}
        className={`p-2 rounded-lg border ${
          expense.fixed
            ? "bg-primary/20 border-primary"
            : "hover:bg-primary/20 hover:border-primary"
        }`}
      >
        <PiPushPinDuotone
          className={expense.fixed ? "text-success" : "text-foreground"}
        />
      </button>

      {/* REMOVER (fixa: oculta só neste mês) */}
      <button
        onClick={() => onDelete(expense.id)}
        title={expense.fixed ? "Ocultar neste mês" : "Remover"}
        className="p-2 rounded-lg border hover:bg-destructive/90 hover:border-destructive"
      >
        <FaTrash className="text-foreground" />
      </button>
    </div>
  );
}
