import type { CustomCategory } from "./types";

/** O que se pode editar numa categoria própria. */
export type CategoryPatch = Partial<Pick<CustomCategory, "name" | "color">>;

/**
 * Os lançamentos guardam a categoria pelo nome. Ao trocar o nome de uma categoria, os que usavam o nome antigo passam
 * para o novo (comparação exata, igual à do servidor). Devolve a mesma lista se nada mudou, para não refazer a tela.
 */
export function renameCategoryIn<T extends { category?: string }>(items: T[], from: string, to: string): T[] {
  if (from === to || !items.some((x) => x.category === from)) return items;
  return items.map((x) => (x.category === from ? { ...x, category: to } : x));
}
