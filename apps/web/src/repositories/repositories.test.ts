import { describe, expect, it } from "vitest";
import { LocalRepository } from "./LocalRepository";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  migrateLegacy,
  migrateStored,
} from "./localMigration";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const legacyPayload = {
  state: {
    currentMonth: "2026-03",
    transactions: [
      { id: "a", name: "Salário", amount: 5000.5, type: "income", category: "Renda", month: "2026-03", fixed: true },
      {
        id: "b",
        name: "Aluguel",
        amount: 1200,
        type: "expense",
        category: "Moradia",
        month: "2026-03",
        fixed: true,
        monthlyValues: { "2026-04": 1300.25 },
      },
      { id: "c", name: "Quebrado", amount: NaN, type: "expense", category: "Outros", month: "2026-03" },
    ],
    creditTransactions: [
      { id: "d", name: "TV", totalAmount: 1999.9, installments: 10, startMonth: "2026-03", category: "Outros" },
    ],
    notes: [{ id: "n", content: "oi", date: "01/03/2026", pinned: false, month: "2026-03" }],
  },
  version: 0,
};

describe("migrateLegacy", () => {
  it("converte reais para centavos em transações, valores por mês e crédito", () => {
    // JSON.stringify transforma NaN em null, como acontece no localStorage de verdade
    const data = migrateLegacy(JSON.parse(JSON.stringify(legacyPayload)))!;

    expect(data.transactions[0].amount).toBe(500050);
    expect(data.transactions[1].amount).toBe(120000);
    expect(data.transactions[1].monthlyValues).toEqual({ "2026-04": 130025 });
    expect(data.creditTransactions[0].totalAmount).toBe(199990);
    expect(data.notes).toHaveLength(1);
  });

  it("valor corrompido vira 0 em vez de NaN", () => {
    const data = migrateLegacy(JSON.parse(JSON.stringify(legacyPayload)))!;
    expect(data.transactions[2].amount).toBe(0);
  });

  it("devolve null quando não é o formato antigo", () => {
    expect(migrateLegacy(null)).toBeNull();
    expect(migrateLegacy({})).toBeNull();
    expect(migrateLegacy({ state: "x" })).toBeNull();
  });
});

describe("migrateStored", () => {
  it("aceita o envelope atual", () => {
    const data = migrateStored({ version: 4, data: { transactions: [], creditTransactions: [], notes: [], goals: [], extraExpenses: [], customCategories: [], distribution: null } });
    expect(data).toEqual({ transactions: [], creditTransactions: [], notes: [], goals: [], extraExpenses: [], customCategories: [], distribution: null });
  });

  it("recusa versão futura e lixo", () => {
    expect(migrateStored({ version: 99, data: {} })).toBeNull();
    expect(migrateStored("texto")).toBeNull();
    expect(migrateStored({ data: {} })).toBeNull();
  });

  it("completa listas que faltam", () => {
    expect(migrateStored({ version: 4, data: {} })).toEqual({
      transactions: [],
      creditTransactions: [],
      notes: [],
      goals: [],
      extraExpenses: [],
      customCategories: [],
      distribution: null,
    });
  });

  it("migra a v1 (sem metas nem extras) sem perder dados", () => {
    const tx = { id: "a", name: "Salário", amount: 100, type: "income", category: "Renda", month: "2026-03" };
    const data = migrateStored({ version: 1, data: { transactions: [tx], creditTransactions: [], notes: [] } });
    expect(data?.transactions).toEqual([tx]);
    expect(data?.goals).toEqual([]);
    expect(data?.extraExpenses).toEqual([]);
  });
});

describe("LocalRepository", () => {
  it("começa vazio sem nenhum dado salvo", async () => {
    const repo = new LocalRepository(fakeStorage());
    expect(await repo.load()).toEqual({ transactions: [], creditTransactions: [], notes: [], goals: [], extraExpenses: [], customCategories: [], distribution: null });
  });

  it("importa o formato antigo uma vez e mantém o backup intacto", async () => {
    const original = JSON.stringify(legacyPayload);
    const storage = fakeStorage({ [LEGACY_STORAGE_KEY]: original });

    const repo = new LocalRepository(storage);
    const data = await repo.load();

    expect(data.transactions[0].amount).toBe(500050);
    expect(storage.map.get(LEGACY_STORAGE_KEY)).toBe(original);
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).version).toBe(4);
  });

  it("depois de migrar, ignora o formato antigo", async () => {
    const storage = fakeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacyPayload) });
    await new LocalRepository(storage).load();

    // o usuário apaga tudo no formato novo: não pode reimportar o antigo por cima
    const second = new LocalRepository(storage);
    await second.load();
    await second.removeTransaction("a");
    const third = await new LocalRepository(storage).load();
    expect(third.transactions.find((t) => t.id === "a")).toBeUndefined();
  });

  it("adiciona, altera e remove, e sobrevive a um novo carregamento", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();

    await repo.addTransaction({
      id: "x",
      name: "Mercado",
      amount: 15000,
      type: "expense",
      category: "Alimentação",
      month: "2026-03",
    });
    await repo.updateTransaction("x", { amount: 17000, fixed: true });
    await repo.addNote({ id: "n1", content: "a", date: "d", pinned: false, month: "2026-03" });
    await repo.updateNote("n1", { pinned: true });
    await repo.addCredit({
      id: "c1",
      name: "TV",
      totalAmount: 100000,
      installments: 4,
      startMonth: "2026-03",
      category: "Outros",
    });

    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.transactions[0]).toMatchObject({ amount: 17000, fixed: true });
    expect(reloaded.notes[0].pinned).toBe(true);
    expect(reloaded.creditTransactions).toHaveLength(1);

    await repo.removeCredit("c1");
    await repo.removeNote("n1");
    await repo.removeTransaction("x");
    expect(await new LocalRepository(storage).load()).toEqual({
      transactions: [],
      creditTransactions: [],
      notes: [],
      goals: [],
      extraExpenses: [],
      customCategories: [],
      distribution: null,
    });
  });

  it("guarda metas e despesas extras", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.addGoal({ id: "g1", name: "Viagem", target: 100000, saved: 0, monthly: 10000, deadline: "2027-07" });
    await repo.updateGoal("g1", { saved: 25000 });
    await repo.addExtraExpense({ id: "e1", name: "IPVA", amount: 110000, month: "2027-01" });

    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.goals[0]).toMatchObject({ id: "g1", saved: 25000 });
    expect(reloaded.extraExpenses).toHaveLength(1);

    await repo.removeGoal("g1");
    await repo.removeExtraExpense("e1");
    const empty = await new LocalRepository(storage).load();
    expect(empty.goals).toEqual([]);
    expect(empty.extraExpenses).toEqual([]);
  });

  it("guarda categorias personalizadas e atualiza compra no crédito", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.addCategory({ id: "k1", name: "Pets", color: "#FF8800" });
    await repo.addCredit({ id: "c1", name: "TV", totalAmount: 100000, installments: 10, startMonth: "2026-03", category: "Pets" });
    await repo.updateCredit("c1", { name: "TV nova", installments: 5 });

    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.customCategories).toEqual([{ id: "k1", name: "Pets", color: "#FF8800" }]);
    expect(reloaded.creditTransactions[0]).toMatchObject({ name: "TV nova", installments: 5, category: "Pets" });

    await repo.removeCategory("k1");
    expect((await new LocalRepository(storage).load()).customCategories).toEqual([]);
  });

  it("migra a v2 (sem categorias) sem perder metas", () => {
    const goal = { id: "g", name: "Viagem", target: 100, saved: 0, monthly: 0, deadline: null };
    const data = migrateStored({ version: 2, data: { goals: [goal] } });
    expect(data?.goals).toEqual([goal]);
    expect(data?.customCategories).toEqual([]);
  });

  it("guarda a distribuição personalizada, edita despesa extra e volta ao padrão com null", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    const items = [{ id: "emergency", label: "Reserva", percent: 100 }];
    await repo.setDistribution(items);
    await repo.addExtraExpense({ id: "e1", name: "IPVA", amount: 1000, month: "2027-01" });
    await repo.updateExtraExpense("e1", { amount: 2000, month: "2027-02" });

    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.distribution).toEqual(items);
    expect(reloaded.extraExpenses[0]).toMatchObject({ amount: 2000, month: "2027-02" });

    await repo.setDistribution(null);
    expect((await new LocalRepository(storage).load()).distribution).toBeNull();
  });

  it("migra a v3 (sem distribuição) para o padrão", () => {
    const data = migrateStored({ version: 3, data: { customCategories: [{ id: "k", name: "Pets", color: "#fff" }] } });
    expect(data?.distribution).toBeNull();
    expect(data?.customCategories).toHaveLength(1);
  });

  it("funciona sem storage disponível", async () => {
    const repo = new LocalRepository({
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(await repo.load()).toEqual({ transactions: [], creditTransactions: [], notes: [], goals: [], extraExpenses: [], customCategories: [], distribution: null });
    await expect(
      repo.addNote({ id: "1", content: "a", date: "d", pinned: false, month: "2026-03" }),
    ).resolves.toBeUndefined();
  });
});
