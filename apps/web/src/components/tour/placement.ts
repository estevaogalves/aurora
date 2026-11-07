export type Side = "top" | "bottom" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  /** lado do elemento onde o cartão ficou; "none" = sem espaço ao redor, cartão fixo na base */
  side: Side | "none";
}

interface Input {
  /** retângulo do destaque, já com a folga (padding) */
  target: Box;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  prefer?: Side[];
  /** distância entre o destaque e o cartão */
  gap?: number;
  /** distância mínima do cartão até a borda da tela */
  margin?: number;
}

const ALL: Side[] = ["bottom", "top", "right", "left"];

/**
 * Escolhe onde por o cartão: o primeiro lado preferido em que ele cabe por inteiro,
 * senão qualquer outro, senão fixo na base da tela. Nunca sai da viewport.
 */
export function computePlacement({ target, card, viewport, prefer = [], gap = 16, margin = 12 }: Input): Placement {
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const room: Record<Side, number> = {
    top: target.top - gap - margin,
    bottom: viewport.height - bottom - gap - margin,
    left: target.left - gap - margin,
    right: viewport.width - right - gap - margin,
  };
  const fits = (side: Side) => (side === "top" || side === "bottom" ? room[side] >= card.height && card.width <= viewport.width - 2 * margin : room[side] >= card.width && card.height <= viewport.height - 2 * margin);

  const side = [...prefer, ...ALL].find(fits);
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.width - card.width - margin));
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.height - card.height - margin));

  if (!side) return { left: clampX((viewport.width - card.width) / 2), top: clampY(viewport.height - card.height - margin), side: "none" };

  if (side === "top" || side === "bottom") {
    const x = target.left + target.width / 2 - card.width / 2;
    return { left: clampX(x), top: clampY(side === "bottom" ? bottom + gap : target.top - gap - card.height), side };
  }
  const y = target.top + target.height / 2 - card.height / 2;
  return { left: clampX(side === "right" ? right + gap : target.left - gap - card.width), top: clampY(y), side };
}
