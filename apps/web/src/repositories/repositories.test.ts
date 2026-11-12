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
    const data = migrateStored({ version: 6, data: { transactions: [], creditTransactions: [], notes: [], goals: [], investments: [], investmentMovements: [], extraExpenses: [], customCategories: [], distribution: null, seenAlerts: [] } });
    expect(data).toEqual({ transactions: [], creditTransactions: [], creditCards: [], notes: [], goals: [], goalMovements: [], investments: [], investmentMovements: [], extraExpenses: [], customCategories: [], distribution: null, distributionOverrides: {}, seenAlerts: [], onboarding: {} });
  });

  it("recusa versão futura e lixo", () => {
    expect(migrateStored({ version: 99, data: {} })).toBeNull();
    expect(migrateStored("texto")).toBeNull();
    expect(migrateStored({ data: {} })).toBeNull();
  });

  it("completa listas que faltam", () => {
    expect(migrateStored({ version: 5, data: {} })).toEqual({
      transactions: [],
      creditTransactions: [],
      creditCards: [],
      notes: [],
      goals: [],
      goalMovements: [],
      investments: [],
      investmentMovements: [],
      extraExpenses: [],
      customCategories: [],
      distribution: null,
      distributionOverrides: {},
      seenAlerts: [],
      onboarding: {},
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

describe("investimentos no LocalRepository", () => {
  it("guarda investimento e movimentações e apaga os dois juntos", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.addInvestment({ id: "i1", name: "CDB", family: "fixed", institution: "Banco A", appliedAt: "2026-01-10", currentValue: 100000 });
    await repo.addInvestmentMovement({ id: "m1", investmentId: "i1", type: "contribution", date: "2026-01-10", amount: 100000 });
    await repo.updateInvestment("i1", { currentValue: 105000 });

    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.investments).toHaveLength(1);
    expect(reloaded.investments?.[0].currentValue).toBe(105000);
    expect(reloaded.investmentMovements).toHaveLength(1);

    await repo.updateInvestmentMovement("m1", { amount: 90000 });
    expect((await new LocalRepository(storage).load()).investmentMovements?.[0].amount).toBe(90000);
    await repo.removeInvestmentMovement("m1");
    expect((await new LocalRepository(storage).load()).investmentMovements).toEqual([]);
    await repo.addInvestmentMovement({ id: "m2", investmentId: "i1", type: "yield", date: "2026-02-01", amount: 5 });

    await repo.removeInvestment("i1");
    const empty = await new LocalRepository(storage).load();
    expect(empty.investments).toEqual([]);
    expect(empty.investmentMovements).toEqual([]);
  });
});

describe("LocalRepository", () => {
  it("começa vazio sem nenhum dado salvo", async () => {
    const repo = new LocalRepository(fakeStorage());
    expect(await repo.load()).toEqual({ transactions: [], creditTransactions: [], creditCards: [], notes: [], goals: [], goalMovements: [], investments: [], investmentMovements: [], extraExpenses: [], customCategories: [], distribution: null, distributionOverrides: {}, seenAlerts: [], onboarding: {} });
  });

  it("importa o formato antigo uma vez e mantém o backup intacto", async () => {
    const original = JSON.stringify(legacyPayload);
    const storage = fakeStorage({ [LEGACY_STORAGE_KEY]: original });

    const repo = new LocalRepository(storage);
    const data = await repo.load();

    expect(data.transactions[0].amount).toBe(500050);
    expect(storage.map.get(LEGACY_STORAGE_KEY)).toBe(original);
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).version).toBe(9);
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
      creditCards: [],
      notes: [],
      goals: [],
      goalMovements: [],
      investments: [],
      investmentMovements: [],
      extraExpenses: [],
      customCategories: [],
      distribution: null,
      distributionOverrides: {},
      seenAlerts: [],
      onboarding: {},
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

  it("editar categoria no LocalRepository renomeia as despesas e compras guardadas e persiste", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.addCategory({ id: "k1", name: "Pets", color: "#FF8800" });
    await repo.addTransaction({ id: "t1", name: "Ração", amount: 5000, type: "expense", category: "Pets", month: "2026-11" });
    await repo.addTransaction({ id: "t2", name: "Mercado", amount: 3000, type: "expense", category: "Alimentação", month: "2026-11" });
    await repo.addCredit({ id: "c1", name: "Caminha", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Pets" });

    await repo.updateCategory("k1", { color: "#123ABC" });
    expect((await new LocalRepository(storage).load()).transactions.map((t) => t.category)).toEqual(["Pets", "Alimentação"]);

    await repo.updateCategory("k1", { name: "Bichos" });
    const reloaded = await new LocalRepository(storage).load();
    expect(reloaded.customCategories).toEqual([{ id: "k1", name: "Bichos", color: "#123ABC" }]);
    expect(reloaded.transactions.map((t) => t.category)).toEqual(["Bichos", "Alimentação"]);
    expect(reloaded.creditTransactions[0].category).toBe("Bichos");

    await repo.updateCategory("nao-existe", { name: "X" });
    expect((await new LocalRepository(storage).load()).customCategories).toHaveLength(1);
  });

  it("v8 -> v9: metas que já tinham valor ganham o 'Saldo inicial', sem mudar nenhum valor", () => {
    const goal = { id: "g", name: "Viagem", target: 100000, saved: 10300, monthly: 0, deadline: null, yieldTotal: 300 };
    const empty = { id: "e", name: "Vazia", target: 100000, saved: 0, monthly: 0, deadline: null };
    const data = migrateStored({ version: 8, data: { goals: [goal, empty] } });
    expect(data?.goalMovements?.map((m) => [m.goalId, m.type, m.amount])).toEqual([["g", "yield", 300], ["g", "adjustment", 10300]]);
    // quem já tem histórico (formato novo) não ganha nada
    const again = migrateStored({ version: 9, data: { goals: [goal], goalMovements: data?.goalMovements } });
    expect(again?.goalMovements).toHaveLength(2);
  });

  it("LocalRepository: o histórico refaz o guardado da meta e sobrevive a um novo carregamento", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.addGoal({ id: "g", name: "Viagem", target: 100000, saved: 0, monthly: 0, deadline: null });
    await repo.addGoalMovement({ id: "m1", goalId: "g", type: "contribution", date: "2026-11-01", amount: 10000 });
    await repo.addGoalMovement({ id: "m2", goalId: "g", type: "yield", date: "2026-11-30", amount: 300 });
    await repo.updateGoalMovement("m1", { amount: 20000 });
    let reloaded = await new LocalRepository(storage).load();
    expect(reloaded.goals[0]).toMatchObject({ saved: 20300, yieldTotal: 300 });
    expect(reloaded.goalMovements).toHaveLength(2);
    await repo.removeGoalMovement("m1");
    reloaded = await new LocalRepository(storage).load();
    expect(reloaded.goals[0].saved).toBe(300);
    await repo.removeGoal("g");
    reloaded = await new LocalRepository(storage).load();
    expect([reloaded.goals, reloaded.goalMovements]).toEqual([[], []]);
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

  it("guarda os avisos vistos e migra a v4 sem eles", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.setSeenAlerts(["g1:2026-12:soon"]);
    expect((await new LocalRepository(storage).load()).seenAlerts).toEqual(["g1:2026-12:soon"]);

    expect(migrateStored({ version: 4, data: { distribution: null } })?.seenAlerts).toEqual([]);
    expect(migrateStored({ version: 5, data: { seenAlerts: ["a", 3, "b"] } })?.seenAlerts).toEqual(["a", "b"]);

    // v5 -> v6: onboarding entra vazio; só respostas válidas são aceitas
    expect(migrateStored({ version: 5, data: {} })?.onboarding).toEqual({});
    expect(migrateStored({ version: 6, data: { onboarding: { painel: "done", metas: "dismissed", x: "talvez", y: 1 } } })?.onboarding).toEqual({ painel: "done", metas: "dismissed" });
    expect(migrateStored({ version: 6, data: { onboarding: ["painel"] } })?.onboarding).toEqual({});
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
    expect(await repo.load()).toEqual({ transactions: [], creditTransactions: [], creditCards: [], notes: [], goals: [], goalMovements: [], investments: [], investmentMovements: [], extraExpenses: [], customCategories: [], distribution: null, distributionOverrides: {}, seenAlerts: [], onboarding: {} });
    await expect(
      repo.addNote({ id: "1", content: "a", date: "d", pinned: false, month: "2026-03" }),
    ).resolves.toBeUndefined();
  });
});

describe("onboarding", () => {
  it("grava a resposta por tela e sobrevive a um novo carregamento", async () => {
    const storage = fakeStorage();
    const repo = new LocalRepository(storage);
    await repo.load();
    await repo.setOnboarding("painel", "done");
    await repo.setOnboarding("metas", "dismissed");
    await repo.setOnboarding("painel", "dismissed"); // mudar uma tela não apaga as outras

    expect((await new LocalRepository(storage).load()).onboarding).toEqual({ painel: "dismissed", metas: "dismissed" });
  });
});

