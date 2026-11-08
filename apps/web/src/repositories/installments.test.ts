import { describe, expect, it } from "vitest";
import { buildCsv, getCreditTotalByMonth, type CreditTransaction } from "../domain";
import { changeMonth, getCurrentMonth } from "../Utils/Date";
import { LocalRepository } from "./LocalRepository";

function fakeStorage() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

const now = getCurrentMonth();
/** 3x de R$ 100: neste mês, no próximo e no seguinte */
const credit: CreditTransaction = { id: "c1", name: "Fone", totalAmount: 30000, installments: 3, startMonth: now, category: "Outros" };

async function repoWithCredit() {
  const storage = fakeStorage();
  const repo = new LocalRepository(storage);
  await repo.addCredit(credit);
  return { repo, storage };
}

describe("LocalRepository: parcelas de uma compra no crédito", () => {
  it("adianta a última parcela futura e persiste o ajuste", async () => {
    const { repo, storage } = await repoWithCredit();
    await repo.advanceInstallment("c1", 3, 800);

    const [saved] = (await new LocalRepository(storage).load()).creditTransactions;
    expect(saved.adjustments?.["3"].advanced).toEqual({ month: now, discount: 800, amount: 9200 });
    expect(getCreditTotalByMonth([saved], now)).toBe(10000 + 9200);
    expect(getCreditTotalByMonth([saved], changeMonth(now, 2))).toBe(0);
    expect(getCreditTotalByMonth([saved], changeMonth(now, 1))).toBe(10000);
  });

  it("recusa adiantar parcela que não é a última, desconto inválido e adiantar duas vezes", async () => {
    const { repo } = await repoWithCredit();
    await expect(repo.advanceInstallment("c1", 2, 0)).rejects.toThrow();
    await expect(repo.advanceInstallment("c1", 1, 0)).rejects.toThrow();
    await expect(repo.advanceInstallment("c1", 3, -1)).rejects.toThrow();
    await expect(repo.advanceInstallment("c1", 3, 10000)).rejects.toThrow();
    await repo.advanceInstallment("c1", 3, 0);
    await expect(repo.advanceInstallment("c1", 3, 0)).rejects.toThrow();
  });

  it("editar e excluir só uma parcela não mexem nas outras nem na compra", async () => {
    const { repo } = await repoWithCredit();
    await repo.editInstallment("c1", 2, 15000);
    await repo.removeInstallment("c1", 1);
    const [saved] = (await repo.load()).creditTransactions;
    expect(saved.totalAmount).toBe(30000);
    expect(getCreditTotalByMonth([saved], now)).toBe(0);
    expect(getCreditTotalByMonth([saved], changeMonth(now, 1))).toBe(15000);
    expect(getCreditTotalByMonth([saved], changeMonth(now, 2))).toBe(10000);
  });

  it("excluir todas remove a compra inteira, inclusive as adiantadas", async () => {
    const { repo } = await repoWithCredit();
    await repo.advanceInstallment("c1", 3, 0);
    await repo.removeCredit("c1");
    expect((await repo.load()).creditTransactions).toEqual([]);
  });
});

describe("exportações", () => {
  it("o CSV traz a parcela adiantada no mês atual, com mês original e desconto", () => {
    const adjusted: CreditTransaction = { ...credit, adjustments: { "3": { advanced: { month: now, discount: 800, amount: 9200 } } } };
    const csv = buildCsv({ transactions: [], creditTransactions: [adjusted] }, [now, changeMonth(now, 2)], { summary: true, entries: false, credit: true });
    expect(csv).toMatch(/Parcela 3\/3 adiantada, original em .*desconto R\$\s?8,00/);
    expect(csv).toContain("92,00");
    // o mês original não cobra mais a parcela
    const lines = csv.split("\n").filter((l) => l.startsWith(changeMonth(now, 2) + ";"));
    expect(lines.some((l) => l.includes("Fone"))).toBe(false);
  });
});
