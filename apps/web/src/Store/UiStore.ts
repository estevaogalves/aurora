import { create } from "zustand";
import { calcReduce, initialCalc, type CalcKey, type CalcState } from "../Features/Calculator/calc";

export type LaunchTab = "expense" | "income" | "credit" | "card" | "extra" | "goal";

interface UiState {
  launchOpen: boolean;
  launchTab: LaunchTab;
  openLaunch: (tab?: LaunchTab) => void;
  closeLaunch: () => void;
  /** Janela de cartões de crédito (modo API: aberta pelo menu do perfil). */
  cardsOpen: boolean;
  openCards: () => void;
  closeCards: () => void;
  /** Calculadora: aberta ou fechada independente do "Lançar". A conta em andamento sobrevive à troca de lugar do card e também ao fechar; só o botão C limpa. */
  calcOpen: boolean;
  calc: CalcState;
  toggleCalc: () => void;
  closeCalc: () => void;
  pressCalc: (key: CalcKey) => void;
  /** Posição da calculadora solta na tela (canto superior esquerdo, em px). null = canto inferior direito. */
  calcPos: { x: number; y: number } | null;
  setCalcPos: (pos: { x: number; y: number } | null) => void;
  /** um tour está aberto: telas sem dados do usuário mostram exemplos para as etapas terem o que destacar */
  tourDemo: boolean;
  setTourDemo: (on: boolean) => void;
}

/** Estado só de tela: o modal "Lançar" é aberto de qualquer lugar. */
export const useUiStore = create<UiState>((set) => ({
  launchOpen: false,
  launchTab: "expense",
  openLaunch: (tab) => set((s) => ({ launchOpen: true, launchTab: tab ?? s.launchTab })),
  // fechar o "Lançar" leva a calculadora junto; o contrário não acontece
  closeLaunch: () => set({ launchOpen: false, calcOpen: false }),
  cardsOpen: false,
  openCards: () => set({ cardsOpen: true }),
  closeCards: () => set({ cardsOpen: false }),
  calcOpen: false,
  calc: initialCalc,
  toggleCalc: () => set((s) => ({ calcOpen: !s.calcOpen })),
  closeCalc: () => set({ calcOpen: false }),
  pressCalc: (key) => set((s) => ({ calc: calcReduce(s.calc, key) })),
  calcPos: null,
  setCalcPos: (pos) => set({ calcPos: pos }),
  tourDemo: false,
  setTourDemo: (on) => set({ tourDemo: on }),
}));
