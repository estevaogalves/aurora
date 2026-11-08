import { create } from "zustand";
import { calcReduce, initialCalc, type CalcKey, type CalcState } from "../Features/Calculator/calc";

export type LaunchTab = "expense" | "income" | "credit" | "extra" | "goal";

interface UiState {
  launchOpen: boolean;
  launchTab: LaunchTab;
  openLaunch: (tab?: LaunchTab) => void;
  closeLaunch: () => void;
  /** Calculadora: aberta ou fechada independente do "Lançar". A conta em andamento sobrevive à troca de lugar do card, mas fechar a calculadora a limpa. */
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
  closeLaunch: () => set({ launchOpen: false, calcOpen: false, calc: initialCalc }),
  calcOpen: false,
  calc: initialCalc,
  // fechar a calculadora limpa a conta
  toggleCalc: () => set((s) => (s.calcOpen ? { calcOpen: false, calc: initialCalc } : { calcOpen: true })),
  closeCalc: () => set({ calcOpen: false, calc: initialCalc }),
  pressCalc: (key) => set((s) => ({ calc: calcReduce(s.calc, key) })),
  calcPos: null,
  setCalcPos: (pos) => set({ calcPos: pos }),
  tourDemo: false,
  setTourDemo: (on) => set({ tourDemo: on }),
}));
