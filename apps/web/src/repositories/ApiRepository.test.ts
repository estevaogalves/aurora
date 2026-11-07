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

  it("uma gravação que falha não trava as seguintes", async () => {
    setAccessToken("t");
    let n = 0;
    mockFetch(() => (n++ === 0 ? new Response(JSON.stringify({ error: "x" }), { status: 500 }) : new Response(null, { status: 204 })));
    const repo = new ApiRepository();
    await expect(repo.removeGoal("a")).rejects.toThrow();
    await expect(repo.removeGoal("b")).resolves.toBeUndefined();
  });
});
