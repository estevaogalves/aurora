/** Etiquetas (tags) de um lançamento: livres, até 10, de até 30 letras, sem repetir (maiúscula e minúscula contam igual). */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** Limpa o que foi digitado: tira espaços e "#" do começo e corta em 30 letras. "" se sobrar nada. */
export function cleanTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH).trim();
}

/** Junta uma etiqueta à lista, sem repetir e respeitando o máximo. Devolve a mesma lista se nada mudou. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = cleanTag(raw);
  if (!tag || tags.length >= MAX_TAGS) return tags;
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}

/** Todas as etiquetas já usadas nos lançamentos, sem repetir (a primeira grafia vale), em ordem alfabética. */
export function allTags(items: { tags?: string[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const t of items.flatMap((i) => i.tags ?? [])) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
