import type { Side } from "./placement";

/** Uma etapa do tour de uma tela. */
export interface TourStep {
  /** aba (caminho) onde o elemento está; só o tour geral usa, para navegar até ela */
  route?: string;
  /** valor do atributo `data-tour` do elemento destacado */
  target: string;
  title: string;
  text: string;
  /** lados preferidos para o cartão, do mais ao menos desejado */
  placement?: Side[];
}

/** Seletor estável do elemento de uma etapa (nunca por classe CSS). */
export const targetSelector = (target: string) => `[data-tour="${target}"]`;

export const findTarget = (target: string): HTMLElement | null => {
  const all = Array.from(document.querySelectorAll<HTMLElement>(targetSelector(target)));
  return all.find((el) => isUsable(el)) ?? all[0] ?? null;
};

/** O elemento existe e ocupa espaço na tela (não está oculto nem fora do DOM). */
export function isUsable(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Etapas cujo elemento está na tela agora; as outras são puladas. */
export const usableSteps = (steps: TourStep[]) => steps.filter((s) => isUsable(findTarget(s.target)));

/** Identifica a etapa (o mesmo alvo pode existir em abas diferentes). */
export const stepKey = (s: TourStep) => `${s.route ?? ""}|${s.target}`;
