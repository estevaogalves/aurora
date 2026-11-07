import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/Types/Category";
import { categoryColors } from "@/Utils/categoryColors";

/** Categorias que o usuário escolhe numa despesa. */
const EXPENSE_CATEGORIES: Category[] = [
  "Moradia",
  "Transporte",
  "Alimentação",
  "Saúde",
  "Educação",
  "Lazer",
  "Serviços",
  "Outros",
];

interface CategorySelectProps {
  value: Category;
  onChange: (category: Category) => void;
  id?: string;
}

export default function CategorySelect({ value, onChange, id }: CategorySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Category)}>
      <SelectTrigger id={id} className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {EXPENSE_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category} className="cursor-pointer">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColors[category] }}
                />
                {category}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
