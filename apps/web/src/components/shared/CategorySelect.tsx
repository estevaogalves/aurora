import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinanceStore } from "@/Store/FinanceStore";
import { EXPENSE_CATEGORIES, type Category } from "@/Types/Category";
import { useCategoryColor } from "@/Utils/categoryColors";
import CategoryDialog from "./CategoryDialog";

interface CategorySelectProps {
  value: Category;
  onChange: (category: Category) => void;
  id?: string;
}

/** Categorias padrão, as do usuário e a opção de criar uma nova. */
export default function CategorySelect({ value, onChange, id }: CategorySelectProps) {
  const custom = useFinanceStore((s) => s.customCategories);
  const colorOf = useCategoryColor();
  const [creating, setCreating] = useState(false);

  const names = [...EXPENSE_CATEGORIES, ...custom.map((c) => c.name)];
  // categoria que foi apagada mas ainda está num lançamento continua selecionável
  if (value && !names.includes(value)) names.push(value);

  return (
    <div className="flex flex-col">
      {/* o Radix emite "" quando a lista muda no mesmo instante em que o valor muda; ignoramos */}
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {names.map((category) => (
              <SelectItem key={category} value={category} className="cursor-pointer">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(category) }} />
                  {category}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <button type="button" onClick={() => setCreating(true)} className="mt-1.5 self-start text-[12.5px] font-semibold text-primary hover:underline">
        + Nova categoria (nome e cor)
      </button>
      <CategoryDialog open={creating} onClose={() => setCreating(false)} onCreated={onChange} />
    </div>
  );
}
