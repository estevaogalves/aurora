import { useCallback } from "react";
import { useFinanceStore } from "../Store/FinanceStore";
import type { Category } from "../Types/Category";

/** Cores das categorias padrão: tokens --k1..--k9 do tema (mudam entre claro e escuro). */
export const categoryColors: Record<string, string> = {
  Moradia: "hsl(var(--k1))",
  Transporte: "hsl(var(--k2))",
  Alimentação: "hsl(var(--k3))",
  Saúde: "hsl(var(--k4))",
  Educação: "hsl(var(--k5))",
  Lazer: "hsl(var(--k6))",
  Serviços: "hsl(var(--k7))",
  Outros: "hsl(var(--k8))",
  Renda: "hsl(var(--success))",
  "Crédito/Parcelado": "hsl(var(--k9))",
};

const FALLBACK = "hsl(var(--k8))";

/** Devolve a cor de uma categoria, padrão ou criada pelo usuário. Reage a mudanças nas categorias. */
export function useCategoryColor() {
  const custom = useFinanceStore((s) => s.customCategories);
  return useCallback(
    (category: Category) => custom.find((c) => c.name === category)?.color ?? categoryColors[category] ?? FALLBACK,
    [custom],
  );
}
