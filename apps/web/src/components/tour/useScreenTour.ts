import { useCallback, useEffect, useState } from "react";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { usableSteps, type TourStep } from "./types";

type Phase = "idle" | "invite" | "tour";

/** Tempo para a tela terminar de desenhar antes de procurar os elementos do tour. */
const SETTLE_MS = 500;

/**
 * Controla o convite e o tour de uma tela.
 * - Só convida depois que os dados carregaram e se a tela ainda não foi respondida.
 * - Não convida se nenhuma etapa tem elemento visível (nada é gravado nesse caso).
 * - Qualquer resposta (recusar, fechar, pular, finalizar) grava o estado da tela.
 */
export function useScreenTour(screen: string, steps: TourStep[]) {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const answer = useFinanceStore((s) => s.onboarding[screen]);
  const setOnboarding = useFinanceStore((s) => s.setOnboarding);
  const launchOpen = useUiStore((s) => s.launchOpen);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<TourStep[]>([]);

  useEffect(() => {
    if (!hydrated || answer || phase !== "idle" || launchOpen) return;
    const timer = setTimeout(() => {
      if (usableSteps(steps).length > 0) setPhase("invite");
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hydrated, answer, phase, launchOpen, steps]);

  const start = useCallback(() => {
    const list = usableSteps(steps);
    if (list.length === 0) {
      setPhase("idle");
      setOnboarding(screen, "dismissed");
      return;
    }
    setActive(list);
    setPhase("tour");
  }, [steps, screen, setOnboarding]);

  const decline = useCallback(() => {
    setPhase("idle");
    setOnboarding(screen, "dismissed");
  }, [screen, setOnboarding]);

  const end = useCallback(
    (state: "done" | "dismissed") => {
      setPhase("idle");
      setOnboarding(screen, state);
    },
    [screen, setOnboarding],
  );

  return { phase, active, start, decline, end };
}
