import { describe, expect, it } from "vitest";
import { COMPARACAO_TOUR } from "@/Features/Comparison/tour";
import { METAS_TOUR } from "@/Features/Goals/tour";
import { LANCAMENTOS_TOUR } from "@/Features/Launch/tour";
import { PAINEL_TOUR } from "@/Features/Dashboard/tour";
import { PROJECAO_TOUR } from "@/Features/Projection/tour";
import { RELATORIOS_TOUR } from "@/Features/Reports/tour";

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
