import { useCallback, useState } from "react";
import { useUiStore } from "@/Store/UiStore";
import { usableSteps, type TourStep } from "./types";

/**
 * Controla o tour de uma tela, que só começa quando o usuário clica no botão ?.
 * Liga os exemplos (`tourDemo`) antes de olhar a tela, para as etapas de cartões
 * sem dados do usuário também entrarem. Se nenhuma etapa tem elemento visível, não abre nada.
 */
export function useScreenTour(steps: TourStep[]) {
  const [active, setActive] = useState<TourStep[] | null>(null);

  const start = useCallback(() => {
    const { setTourDemo } = useUiStore.getState();
    setTourDemo(true);
    // espera a tela redesenhar com os exemplos
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const list = usableSteps(steps);
        if (list.length === 0) setTourDemo(false);
        setActive(list.length > 0 ? list : null);
      }),
    );
  }, [steps]);

  const end = useCallback(() => setActive(null), []);

  return { active, start, end };
}
