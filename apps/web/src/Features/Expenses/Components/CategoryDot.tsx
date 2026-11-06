import type { Category } from "../../../Types/Category";
import { categoryColors } from "../../../Utils/categoryColors";

interface Props { 
    category: Category
}

export default function CategoryDot({category}: Props) {
  return (
    <span
      className="h-3 w-3 rounded-full flex-shrink-0"
      style={{
        backgroundColor: categoryColors[category],
      }}
    />
  );
}
