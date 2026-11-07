import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { GLOBAL_TOUR, GLOBAL_TOUR_KEY } from "./globalTour";
import SpotlightTour from "./SpotlightTour";
import TourInvite from "./TourInvite";

/** Tempo para a tela terminar de desenhar antes de convidar. */
const SETTLE_MS = 500;

/**
 * Tour de todas as abas de uma vez. Convida no primeiro acesso (uma única vez);
 * qualquer resposta (recusar, fechar, pular, finalizar) fica gravada. Ao terminar, volta para a aba de onde saiu.
 */
export default function AppTour() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const answer = useFinanceStore((s) => s.onboarding[GLOBAL_TOUR_KEY]);
  const setOnboarding = useFinanceStore((s) => s.setOnboarding);
  const launchOpen = useUiStore((s) => s.launchOpen);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "invite" | "tour">("idle");
  const [origin, setOrigin] = useState("/painel");

  useEffect(() => {
    if (!hydrated || answer || phase !== "idle" || launchOpen) return;
    const timer = setTimeout(() => setPhase("invite"), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hydrated, answer, phase, launchOpen]);

  function finish(state: "done" | "dismissed") {
    setPhase("idle");
    setOnboarding(GLOBAL_TOUR_KEY, state);
    if (phase === "tour") navigate(origin);
  }

  return (
    <>
      <TourInvite
        open={phase === "invite"}
        title="Bem-vindo ao Aurora!"
        description="Quer um tour rápido por todas as abas do app? Em cerca de 2 minutos você vê o que cada uma mostra. Depois, o botão ? de cada tela refaz o tour só daquela tela."
        onStart={() => {
          setOrigin(window.location.pathname);
          setPhase("tour");
        }}
        onDecline={() => finish("dismissed")}
      />
      {phase === "tour" && <SpotlightTour steps={GLOBAL_TOUR} onEnd={finish} />}
    </>
  );
}
