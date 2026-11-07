import SpotlightTour from "./SpotlightTour";
import TourInvite from "./TourInvite";
import type { TourStep } from "./types";
import { useScreenTour } from "./useScreenTour";

/**
 * Coloque uma vez em cada página: `<ScreenTour screen="painel" steps={PAINEL_TOUR} />`.
 * `steps` precisa ser uma constante (fora do componente) para não reiniciar o controle a cada render.
 */
export default function ScreenTour({ screen, steps }: { screen: string; steps: TourStep[] }) {
  const { phase, active, start, decline, end } = useScreenTour(screen, steps);
  return (
    <>
      <TourInvite open={phase === "invite"} onStart={start} onDecline={decline} />
      {phase === "tour" && <SpotlightTour steps={active} onEnd={end} />}
    </>
  );
}
