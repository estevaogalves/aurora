import { useCallback, useState } from "react";
import { usableSteps, type TourStep } from "./types";

/**
 * Controla o tour de uma tela, que só começa quando o usuário clica no botão ?.
 * Se nenhuma etapa tem elemento visível, não abre nada.
 */
export function useScreenTour(steps: TourStep[]) {
  const [active, setActive] = useState<TourStep[] | null>(null);

  const start = useCallback(() => {
    const list = usableSteps(steps);
    setActive(list.length > 0 ? list : null);
  }, [steps]);

  const end = useCallback(() => setActive(null), []);

  return { active, start, end };
}
