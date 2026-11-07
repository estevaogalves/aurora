import { COMPARACAO_TOUR } from "@/Features/Comparison/tour";
import { METAS_TOUR } from "@/Features/Goals/tour";
import { LANCAMENTOS_TOUR } from "@/Features/Launch/tour";
import { PAINEL_TOUR } from "@/Features/Dashboard/tour";
import { PROJECAO_TOUR } from "@/Features/Projection/tour";
import { RELATORIOS_TOUR } from "@/Features/Reports/tour";
import type { TourStep } from "./types";

/** Chave em que se grava a resposta ao convite do tour geral. */
export const GLOBAL_TOUR_KEY = "geral";

const on = (route: string, steps: TourStep[]): TourStep[] => steps.map((s) => ({ ...s, route }));

/** Tour por todas as abas, na ordem do menu. */
export const GLOBAL_TOUR: TourStep[] = [
  { route: "/painel", target: "abas", title: "As abas do Aurora", text: "Cada aba mostra os seus números de um jeito: Painel, Lançamentos, Projeção, Comparação, Metas e Relatórios. Vamos passar por todas elas.", placement: ["bottom"] },
  ...on("/painel", PAINEL_TOUR),
  ...on("/lancamentos", LANCAMENTOS_TOUR),
  ...on("/projecao", PROJECAO_TOUR),
  ...on("/comparacao", COMPARACAO_TOUR),
  ...on("/metas", METAS_TOUR),
  ...on("/relatorios", RELATORIOS_TOUR),
];
