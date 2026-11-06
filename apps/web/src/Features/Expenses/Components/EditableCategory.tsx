import { RiArrowDownSFill } from "react-icons/ri";
import type { Category } from "../../../Types/Category";

interface Props {
  expenseId: string;
  category: Category;

  editingCategory: string | null;
  tempCategory: Category | null;

  setEditingCategory: (id: string | null) => void;
  setTempCategory: (category: Category) => void;

  onUpdate: (id: string, category: Category) => void;
}

export default function EditableCategory({
  expenseId,
  category,
  editingCategory,
  tempCategory,
  setEditingCategory,
  setTempCategory,
  onUpdate,
}: Props) {
  if (editingCategory === expenseId) {
    return (
      <div className="relative inline-block">
        <select
          value={tempCategory ?? ""}
          onChange={(e) => {
            const value = e.target.value as Category;
            setTempCategory(value);
            onUpdate(expenseId, value);
            setEditingCategory(null);
          }}
          onBlur={() => setEditingCategory(null)}
          className="text-sm font-medium border bg-gray-200 pl-3 pr-6 py-1 min-w-[130px] rounded-full text-gray-600 appearance-none outline-none cursor-pointer"
        >
          <option value="Moradia">Moradia</option>
          <option value="Transporte">Transporte</option>
          <option value="Alimentação">Alimentação</option>
          <option value="Saúde">Saúde</option>
          <option value="Educação">Educação</option>
          <option value="Lazer">Lazer</option>
          <option value="Serviços">Serviços</option>
          <option value="Outros">Outros</option>
        </select>

        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">
          <RiArrowDownSFill className="text-2xl" />
        </span>
      </div>
    );
  }

  return (
    <span
      onClick={() => {
        setEditingCategory(expenseId);
        setTempCategory(category);
      }}
      className="text-sm font-medium border bg-gray-200 px-3 py-1 rounded-full text-gray-600 cursor-pointer"
    >
      {category}
    </span>
  );
}