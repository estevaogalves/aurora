import { FaTrash } from "react-icons/fa6";
import { PiPushPinDuotone } from "react-icons/pi";

interface Props {
  expense: any;

  editingAmount: string | null;
  tempAmount: string;

  setEditingAmount: (id: string | null) => void;
  setTempAmount: (value: string) => void;

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

  return (
    <div className="flex items-center gap-4">
      
      {/* VALOR */}
      {isEditing ? (
        <div className="flex items-center border-2 text-white bg-slate-900 border-emerald-600 rounded-lg px-3 py-2">
          <span className="mr-1">R$</span>
          <input
            type="number"
            value={tempAmount}
            autoFocus
            onChange={(e) => setTempAmount(e.target.value)}
            onBlur={() => {
              onUpdateAmount(expense.id, Number(tempAmount) || 0);
              setEditingAmount(null);
            }}
            className="bg-transparent outline-none w-24"
          />
        </div>
      ) : (
        <span
          onClick={() => {
            setEditingAmount(expense.id);
            setTempAmount(String(expense.amount ?? ""));
          }}
          className="font-bold text-lg text-white cursor-pointer"
        >
          R${" "}
          {(expense.amount ?? 0).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
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

      {/* REMOVER */}
      <button
        onClick={() => onDelete(expense.id)}
        disabled={expense.fixed}
        className={`p-2 rounded-lg border ${
          expense.fixed
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-red-900 hover:border-red-400"
        }`}
      >
        <FaTrash className="text-white" />
      </button>
    </div>
  );
}