interface Props {
  expenseId: string;
  amount: number | null;

  editingAmount: string | null;
  tempAmount: string;

  setEditingAmount: (id: string | null) => void;
  setTempAmount: (value: string) => void;

  onUpdate: (id: string, value: number) => void;
}

export default function EditableAmount({
  expenseId,
  amount,
  editingAmount,
  tempAmount,
  setEditingAmount,
  setTempAmount,
  onUpdate,
}: Props) {
  const isEditing = editingAmount === expenseId;

  if (isEditing) {
    return (
      <div className="flex items-center border-2 text-white bg-slate-900 border-emerald-600 rounded-lg px-3 py-2">
        <span className="mr-1">R$</span>
        <input
          type="number"
          value={tempAmount}
          autoFocus
          onChange={(e) => setTempAmount(e.target.value)}
          onBlur={() => {
            const value = parseFloat(tempAmount);

            onUpdate(expenseId, isNaN(value) ? 0 : value);
            setEditingAmount(null);
          }}
          className="bg-transparent outline-none w-24"
        />
      </div>
    );
  }

  return (
    <span
      onClick={() => {
        setEditingAmount(expenseId);
        setTempAmount(String(amount ?? ""));
      }}
      className="font-bold text-lg text-white cursor-pointer"
    >
      R${" "}
      {(amount ?? 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })}
    </span>
  );
}
