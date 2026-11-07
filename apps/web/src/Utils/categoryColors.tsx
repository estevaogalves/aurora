import type { Category } from "../Types/Category";

/** Cores das categorias: tokens --k1..--k9 do tema (mudam entre claro e escuro). */
export const categoryColors: Record<Category, string> = {
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
