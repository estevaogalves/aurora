import { describe, expect, it } from "vitest";
import { computePlacement } from "./placement";

const viewport = { width: 1280, height: 800 };
const card = { width: 320, height: 200 };

describe("computePlacement", () => {
  it("usa o primeiro lado preferido em que o cartão cabe", () => {
    const p = computePlacement({ target: { left: 100, top: 100, width: 300, height: 100 }, card, viewport, prefer: ["right", "bottom"] });
    expect(p.side).toBe("right");
    expect(p.left).toBe(100 + 300 + 16);
  });

  it("passa para outro lado quando o preferido não tem espaço", () => {
    // elemento colado no fim da tela: embaixo não cabe, em cima sim
    const p = computePlacement({ target: { left: 500, top: 700, width: 200, height: 80 }, card, viewport, prefer: ["bottom", "top"] });
    expect(p.side).toBe("top");
    expect(p.top).toBe(700 - 16 - card.height);
  });

  it("centraliza o cartão no elemento e respeita as bordas", () => {
    const p = computePlacement({ target: { left: 1200, top: 20, width: 60, height: 40 }, card, viewport, prefer: ["bottom"] });
    expect(p.side).toBe("bottom");
    expect(p.left + card.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(p.left).toBeGreaterThanOrEqual(12);
  });

  it("sem espaço em nenhum lado, fixa o cartão na base da tela", () => {
    const p = computePlacement({ target: { left: 4, top: 4, width: 372, height: 740 }, card: { width: 340, height: 220 }, viewport: { width: 380, height: 750 } });
    expect(p.side).toBe("none");
    expect(p.top + 220).toBeLessThanOrEqual(750 - 12);
    expect(p.left).toBeGreaterThanOrEqual(12);
  });

  it("nunca deixa o cartão sair da viewport", () => {
    for (const left of [0, 300, 900, 1200]) {
      for (const top of [0, 300, 700]) {
        const p = computePlacement({ target: { left, top, width: 80, height: 60 }, card, viewport, prefer: ["left", "top"] });
        expect(p.left).toBeGreaterThanOrEqual(12);
        expect(p.top).toBeGreaterThanOrEqual(12);
        expect(p.left + card.width).toBeLessThanOrEqual(viewport.width - 12);
        expect(p.top + card.height).toBeLessThanOrEqual(viewport.height - 12);
      }
    }
  });
});
