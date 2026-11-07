import SpotlightTour from "./SpotlightTour";
import TourHelpButton from "./TourHelpButton";
import type { TourStep } from "./types";
import { useScreenTour } from "./useScreenTour";

/**
 * Botão ? que refaz o tour só desta tela. Fica no cabeçalho da página (veja `PageHeader`).
 * `steps` precisa ser uma constante (fora do componente) para não reiniciar o controle a cada render.
 */
export default function ScreenTour({ steps }: { steps: TourStep[] }) {
  const { active, start, end } = useScreenTour(steps);
  return (
    <>
      <TourHelpButton onClick={start} label="Refazer o tour desta tela" />
      {active && <SpotlightTour steps={active} onEnd={end} />}
    </>
  );
}
