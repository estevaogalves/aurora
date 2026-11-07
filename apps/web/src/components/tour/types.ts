import type { Side } from "./placement";

/** Uma etapa do tour de uma tela. */
export interface TourStep {
  /** valor do atributo `data-tour` do elemento destacado */
  target: string;
  title: string;
  text: string;
  /** lados preferidos para o cartão, do mais ao menos desejado */
  placement?: Side[];
}

/** Seletor estável do elemento de uma etapa (nunca por classe CSS). */
export const targetSelector = (target: string) => `[data-tour="${target}"]`;

export const findTarget = (target: string): HTMLElement | null => document.querySelector<HTMLElement>(targetSelector(target));

/** O elemento existe e ocupa espaço na tela (não está oculto nem fora do DOM). */
export function isUsable(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Etapas cujo elemento está na tela agora; as outras são puladas. */
export const usableSteps = (steps: TourStep[]) => steps.filter((s) => isUsable(findTarget(s.target)));
