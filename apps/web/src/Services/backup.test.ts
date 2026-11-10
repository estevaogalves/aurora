import { describe, expect, it } from "vitest";
import { emptyData } from "../repositories/localMigration";
import { LocalRepository } from "../repositories/LocalRepository";
import { buildBackup, describeBackup, parseBackup } from "./backup";

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
};

const sample = () => ({
  ...emptyData(),
  transactions: [{ id: "t1", name: "Luz", amount: 18000, type: "expense" as const, category: "Moradia" as const, month: "2026-11", fixed: true, variableAmount: true, monthlyValues: { "2026-12": 21050 } }],
  goals: [{ id: "g1", name: "Viagem", target: 100000, saved: 0, monthly: 0, yieldTotal: 0, deadline: null }],
});

describe("backup", () => {
  it("o que se exporta volta igual ao importar", () => {
    const data = sample();
    expect(parseBackup(buildBackup(data))).toEqual(data);
  });

  it("aceita o 'Exportar meus dados' da conta (sem version)", () => {
    const file = JSON.stringify({ exportedAt: "2026-11-10T00:00:00Z", user: { email: "a@b.c" }, data: sample() });
    expect(parseBackup(file)?.transactions).toHaveLength(1);
  });

  it("recusa o que não é backup do Aurora", () => {
    expect(parseBackup("isso não é json")).toBeNull();
    expect(parseBackup("[]")).toBeNull();
    expect(parseBackup(JSON.stringify({ foo: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 999, data: sample() }))).toBeNull();
  });

  it("conta só o que existe", () => {
    expect(describeBackup(sample())).toEqual([["Lançamentos (rendas e despesas)", 1], ["Metas", 1]]);
  });

  it("restaurar troca tudo no navegador e sobrevive a recarregar", async () => {
    const storage = memory();
    const repo = new LocalRepository(storage);
    await repo.addTransaction({ id: "velha", name: "Velha", amount: 1, type: "expense", category: "Outros", month: "2026-01" });
    await repo.replaceAll(parseBackup(buildBackup(sample()))!);
    const loaded = await new LocalRepository(storage).load();
    expect(loaded.transactions.map((t) => t.id)).toEqual(["t1"]);
    expect(loaded.goals).toHaveLength(1);
  });
});
