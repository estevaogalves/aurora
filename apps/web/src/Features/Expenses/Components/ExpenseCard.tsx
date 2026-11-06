import { PiPushPinDuotone } from "react-icons/pi";

import Actions from "./Actions";
import CategoryDot from "./CategoryDot";
import EditableCategory from "./EditableCategory";
import EditableName from "./EditableName";

import { Card } from "../../../components/ui/card";
import type { Transaction } from "../../../Store/FinanceStore";
import type { Category } from "../../../Types/Category";

interface Props {
  expense: Transaction;

  // estados
  editingName: string | null;
  tempName: string;

  editingCategory: string | null;
  tempCategory: Category | null;

  editingAmount: string | null;
  tempAmount: string;

  // setters
  setEditingName: (id: string | null) => void;
  setTempName: (value: string) => void;

  setEditingCategory: (id: string | null) => void;
  setTempCategory: (value: Category) => void;

  setEditingAmount: (id: string | null) => void;
  setTempAmount: (value: string) => void;

  // handlers
  onUpdateName: (id: string, name: string) => void;
  onUpdateCategory: (id: string, category: Category) => void;
  onUpdateAmount: (id: string, value: number) => void;

  onToggleFixed: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseCard({
  expense,

  editingName,
  tempName,
  editingCategory,
  tempCategory,
  editingAmount,
  tempAmount,

  setEditingName,
  setTempName,
  setEditingCategory,
  setTempCategory,
  setEditingAmount,
  setTempAmount,

  onUpdateName,
  onUpdateCategory,
  onUpdateAmount,

  onToggleFixed,
  onDelete,
}: Props) {
  return (
    <Card className="hover:bg-slate-800/20 bg-slate-900 border-slate-600 w-full relative">
      {/* FIXADO */}
      {expense.fixed && (
        <div className="absolute -top-4 -right-4 z-10">
          <div className="bg-green-900 border border-emerald-600 rounded-full p-1.5 shadow-md">
            <PiPushPinDuotone className="text-white rotate-20" size={16} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 p-4 w-full">
        {/* CATEGORIA */}
        <CategoryDot category={expense.category} />

        {/* TEXTO */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <EditableName
              expenseId={expense.id}
              name={expense.name}
              editingName={editingName}
              tempName={tempName}
              setEditingName={setEditingName}
              setTempName={setTempName}
              onUpdate={onUpdateName}
            />

            <EditableCategory
              expenseId={expense.id}
              category={expense.category}
              editingCategory={editingCategory}
              tempCategory={tempCategory}
              setEditingCategory={setEditingCategory}
              setTempCategory={setTempCategory}
              onUpdate={onUpdateCategory}
            />
          </div>

          {expense.notes && (
            <p className="text-base font-medium text-gray-300 mt-1 truncate">
              {expense.notes}
            </p>
          )}
        </div>

        {/* AÇÕES */}
        <Actions
          expense={expense}
          editingAmount={editingAmount}
          tempAmount={tempAmount}
          setEditingAmount={setEditingAmount}
          setTempAmount={setTempAmount}
          onUpdateAmount={onUpdateAmount}
          onToggleFixed={onToggleFixed}
          onDelete={onDelete}
        />
      </div>
    </Card>
  );
}
