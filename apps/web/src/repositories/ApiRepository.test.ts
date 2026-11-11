import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../api/http";
import { ApiRepository, normalizeFinanceData } from "./ApiRepository";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
      return handler(url, init);
    }),
  );
  return calls;
}

describe("normalizeFinanceData (omitempty da API)", () => {
  it("completa os campos que a API omite", () => {
    const data = normalizeFinanceData({
      transactions: [
        { id: "1", name: "Mercado", amount: 100, type: "expense", category: "Outros", month: "2026-03" },
        { id: "2", name: "Aluguel", amount: 900, type: "expense", category: "Moradia", month: "2026-03", fixed: true },
      ],
      goals: [{ id: "g", name: "Viagem", target: 1000, saved: 0, monthly: 0, deadline: null }],
    });
    expect(data.transactions[0]).toMatchObject({ fixed: false, notes: "", hiddenMonths: undefined, monthlyValues: undefined });
    expect(data.transactions[1]).toMatchObject({ fixed: true, hiddenMonths: [], monthlyValues: {} });
    expect(data.goals[0].yieldTotal).toBe(0);
    expect(data.distribution).toBeNull();
    expect(data.seenAlerts).toEqual([]);
    expect(data.notes).toEqual([]);
    expect(data.onboarding).toEqual({});
  });
});

describe("ApiRepository: investimentos", () => {
  it("load traz investimentos e movimentações; sem eles, listas vazias", async () => {
    setAccessToken("t");
    const inv = { id: "i1", name: "CDB", family: "fixed", institution: "Banco A", appliedAt: "2026-01-01", currentValue: 1000 };
    const mov = { id: "m1", investmentId: "i1", type: "contribution", date: "2026-01-01", amount: 1000 };
    mockFetch(() => new Response(JSON.stringify({ investments: [inv], investmentMovements: [mov] }), { status: 200 }));
    const data = await new ApiRepository().load();
    expect(data.investments).toEqual([inv]);
    expect(data.investmentMovements).toEqual([mov]);
    expect(normalizeFinanceData({}).investments).toEqual([]);
    expect(normalizeFinanceData({}).investmentMovements).toEqual([]);
  });

  it("cadastra, movimenta e remove pelas rotas da API", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    const repo = new ApiRepository();
    const inv = { id: "i1", name: "CDB", family: "fixed" as const, institution: "Banco A", appliedAt: "2026-01-01", currentValue: 1000 };
    const mov = { id: "m1", investmentId: "i1", type: "contribution" as const, date: "2026-01-01", amount: 1000 };
    await repo.addInvestment(inv);
    await repo.addInvestmentMovement(mov);
    await repo.updateInvestmentMovement("m1", { amount: 900 });
    await repo.removeInvestmentMovement("m1");
    await repo.removeInvestment("i1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/v1/investments",
      "POST /api/v1/investment-movements",
      "PATCH /api/v1/investment-movements/m1",
      "DELETE /api/v1/investment-movements/m1",
      "DELETE /api/v1/investments/i1",
    ]);
    expect(calls[0].body).toEqual(inv);
    expect(calls[2].body).toEqual({ amount: 900 });
  });

  it("campo limpo no Editar (undefined) vira o valor que a API entende como limpar", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    await new ApiRepository().updateInvestment("i1", {
      name: "CDB", maturityDate: undefined, rate: undefined, earlyRedeem: undefined, redeemDays: undefined, quantity: undefined, avgPrice: undefined, notes: undefined,
    });
    expect(calls[0].body).toEqual({ name: "CDB", maturityDate: "", rate: "", earlyRedeem: false, redeemDays: 0, quantity: null, avgPrice: null, notes: "" });
  });

  it("só manda os campos que vieram e ignora o que a API não aceita", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    await new ApiRepository().updateInvestment("i1", { id: "i1", currentValue: 5000 });
    expect(calls[0].body).toEqual({ currentValue: 5000 });
    await new ApiRepository().updateInvestmentMovement("m1", { id: "m1", investmentId: "x", quantity: undefined, unitPrice: undefined });
    expect(calls[1].body).toEqual({ quantity: null, unitPrice: null });
  });
});

describe("ApiRepository", () => {
  it("load lê /data e normaliza", async () => {
    setAccessToken("t");
    mockFetch(() => new Response(JSON.stringify({ transactions: [], distribution: null }), { status: 200 }));
    const data = await new ApiRepository().load();
    expect(data.creditTransactions).toEqual([]);
  });

  it("PATCH envia só os campos que a API aceita", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    await new ApiRepository().updateTransaction("abc", { id: "abc", name: "Novo", month: "2026-01", hiddenMonths: ["2026-02"] });
    expect(calls[0]).toMatchObject({ url: "/api/v1/transactions/abc", method: "PATCH", body: { name: "Novo", hiddenMonths: ["2026-02"] } });
  });

  it("limpar o prazo da meta manda deadline: null", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    await new ApiRepository().updateGoal("g", { deadline: null });
    expect(calls[0].body).toEqual({ deadline: null });
  });

  it("o PATCH espera o POST que criou o registro terminar", async () => {
    setAccessToken("t");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = mockFetch(async (_url, init) => {
      if (init.method === "POST") await gate;
      return new Response(null, { status: 201 });
    });
    const repo = new ApiRepository();
    const t = { id: "x", name: "A", amount: 1, type: "expense" as const, category: "Outros", month: "2026-03" };
    const add = repo.addTransaction(t);
    const patch = repo.updateTransaction("x", { name: "B" });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls.map((c) => c.method)).toEqual(["POST"]);
    release();
    await Promise.all([add, patch]);
    expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
  });

  it("grava a resposta do tour de uma tela só com a chave dela", async () => {
    setAccessToken("t");
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    await new ApiRepository().setOnboarding("painel", "done");
    expect(calls[0]).toMatchObject({ url: "/api/v1/settings/onboarding/painel", method: "PUT", body: { state: "done" } });
  });

  it("uma gravação que falha não trava as seguintes", async () => {
    setAccessToken("t");
    let n = 0;
    mockFetch(() => (n++ === 0 ? new Response(JSON.stringify({ error: "x" }), { status: 500 }) : new Response(null, { status: 204 })));
    const repo = new ApiRepository();
    await expect(repo.removeGoal("a")).rejects.toThrow();
    await expect(repo.removeGoal("b")).resolves.toBeUndefined();
  });
});
