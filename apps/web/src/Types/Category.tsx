/** Nome da categoria: uma das padrão (BUILTIN_CATEGORIES) ou uma criada pelo usuário. */
export type Category = string;

/** Categorias que o usuário escolhe numa despesa, antes das próprias. */
export const EXPENSE_CATEGORIES: Category[] = [
  "Moradia",
  "Transporte",
  "Alimentação",
  "Saúde",
  "Educação",
  "Lazer",
  "Serviços",
  "Outros",
];

/** Categorias que o sistema usa por conta própria. */
export const INCOME_CATEGORY: Category = "Renda";
export const CREDIT_CATEGORY_NAME: Category = "Crédito/Parcelado";

export const BUILTIN_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, INCOME_CATEGORY, CREDIT_CATEGORY_NAME];

/**
 * Categorias para escolher numa despesa: as padrão, depois as do usuário, e "Outros" sempre por último (uma categoria
 * nova aparece acima de "Outros"). `extra` são nomes que continuam em uso mesmo depois de apagados.
 */
export function expenseCategoryOptions(custom: string[], extra: string[] = []): Category[] {
  const base = EXPENSE_CATEGORIES.filter((c) => c !== "Outros");
  const names = [...base];
  for (const c of [...custom, ...extra]) if (c !== "Outros" && !names.includes(c)) names.push(c);
  return [...names, "Outros"];
}
