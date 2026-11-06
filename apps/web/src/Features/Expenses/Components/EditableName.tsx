interface Props {
  expenseId: string;
  name: string;

  editingName: string | null;
  tempName: string;

  setEditingName: (id: string | null) => void;
  setTempName: (value: string) => void;

  onUpdate: (id: string, name: string) => void;
}

export default function EditableName({
  expenseId,
  name,
  editingName,
  tempName,
  setEditingName,
  setTempName,
  onUpdate,
}: Props) {
  if (editingName === expenseId) {
    return (
      <input
        type="text"
        value={tempName}
        autoFocus
        onChange={(e) => setTempName(e.target.value)}
        onBlur={() => onUpdate(expenseId, tempName)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onUpdate(expenseId, tempName);
          }
        }}
        className="bg-slate-800 text-white font-bold text-lg px-2 py-1 rounded border border-emerald-600 outline-none w-[200px]"
      />
    );
  }

  return (
    <h2
      onClick={() => {
        setEditingName(expenseId);
        setTempName(name);
      }}
      className="font-bold text-lg truncate max-w-[200px] text-white cursor-pointer hover:text-green-600 transition-colors duration-300"
    >
      {name}
    </h2>
  );
}