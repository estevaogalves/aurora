import { useRef } from "react";

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
  // Esc cancela: o blur que vem junto não pode salvar o texto descartado
  const cancelled = useRef(false);

  if (editingName === expenseId) {
    return (
      <input
        type="text"
        value={tempName}
        autoFocus
        onChange={(e) => setTempName(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          onUpdate(expenseId, tempName);
          setEditingName(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            cancelled.current = true;
            setTempName(name);
            setEditingName(null);
          }
        }}
        className="bg-secondary text-foreground font-bold text-lg px-2 py-1 rounded border border-primary outline-none w-[200px]"
      />
    );
  }

  return (
    <h2
      onClick={() => {
        setEditingName(expenseId);
        setTempName(name);
      }}
      className="font-bold text-lg truncate max-w-[200px] text-foreground cursor-pointer hover:text-primary transition-colors duration-300"
    >
      {name}
    </h2>
  );
}