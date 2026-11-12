import { describe, expect, it } from "vitest";
import { addTag, allTags, cleanTag } from "./index";

describe("etiquetas", () => {
  it("limpa o texto: espaços, # e tamanho", () => {
    expect(cleanTag("  #Viagem  ")).toBe("Viagem");
    expect(cleanTag("a   b")).toBe("a b");
    expect(cleanTag("x".repeat(40))).toHaveLength(30);
    expect(cleanTag("###")).toBe("");
  });
  it("não repete (maiúscula e minúscula contam igual) e respeita o máximo de 10", () => {
    expect(addTag(["viagem"], "VIAGEM")).toEqual(["viagem"]);
    expect(addTag(["a"], "b")).toEqual(["a", "b"]);
    expect(addTag([], "   ")).toEqual([]);
    const full = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(addTag(full, "outra")).toBe(full);
  });
  it("todas as etiquetas usadas, sem repetir e em ordem", () => {
    expect(allTags([{ tags: ["viagem", "Heitor"] }, { tags: ["Viagem"] }, {}])).toEqual(["Heitor", "viagem"]);
  });
});
