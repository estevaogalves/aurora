import { describe, expect, it } from "vitest";
import { COMPARACAO_TOUR } from "@/Features/Comparison/tour";
import { METAS_TOUR } from "@/Features/Goals/tour";
import { LANCAMENTOS_TOUR } from "@/Features/Launch/tour";
import { PAINEL_TOUR } from "@/Features/Dashboard/tour";
import { PROJECAO_TOUR } from "@/Features/Projection/tour";
import { RELATORIOS_TOUR } from "@/Features/Reports/tour";

import { GLOBAL_TOUR } from "./globalTour";
import { stepKey } from "./types";

const TOURS = { painel: PAINEL_TOUR, lancamentos: LANCAMENTOS_TOUR, projecao: PROJECAO_TOUR, comparacao: COMPARACAO_TOUR, metas: METAS_TOUR, relatorios: RELATORIOS_TOUR };

describe("etapas dos tours", () => {
  for (const [screen, steps] of Object.entries(TOURS)) {
    it(`${screen}: etapas com alvo único, título e texto`, () => {
      expect(steps.length).toBeGreaterThan(0);
      expect(new Set(steps.map((s) => s.target)).size).toBe(steps.length);
      for (const s of steps) {
        expect(s.title.trim()).not.toBe("");
        expect(s.text.trim()).not.toBe("");
      }
    });
  }
});

describe("tour geral", () => {
  it("cobre todas as abas na ordem do menu, com rota em cada etapa", () => {
    const routes = [...new Set(GLOBAL_TOUR.map((s) => s.route))];
    expect(routes).toEqual(["/painel", "/lancamentos", "/projecao", "/comparacao", "/metas", "/relatorios"]);
    expect(new Set(GLOBAL_TOUR.map(stepKey)).size).toBe(GLOBAL_TOUR.length);
  });
});
