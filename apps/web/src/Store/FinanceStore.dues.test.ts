import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateTransaction: vi.fn(() => Promise.resolve()), setTransactionPayment: vi.fn(() => Promise.resolve()), setSeenAlerts: vi.fn(() => Promise.resolve()) }));
vi.mock("../repositories", () => ({ repository: repo }));

import { getUpcomingDues } from "@/domain";
import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({
    transactions: [
      { id: "e1", name: "Internet", amount: 12000, type: "expense", category: "Moradia", month: "2026-11" },
      { id: "i1", name: "Salário", amount: 300000, type: "income", category: "Renda", month: "2026-11" },
    ],
    creditTransactions: [],
    creditCards: [],
    seenAlerts: [],
  });
});

describe("dia do vencimento na store", () => {
  it("define, troca e tira o dia da despesa, avisando o repositório", () => {
    store().setTransactionDueDay("e1", 15);
    expect(store().transactions[0].dueDay).toBe(15);
    expect(repo.updateTransaction).toHaveBeenCalledWith("e1", { dueDay: 15 });
    store().setTransactionDueDay("e1", 0);
    expect(store().transactions[0].dueDay).toBeUndefined();
  });

  it("recusa dia inválido e renda", () => {
    store().setTransactionDueDay("e1", 32);
    expect(store().transactions[0].dueDay).toBeUndefined();
    store().setTransactionDueDay("i1", 5);
    expect(store().transactions[1].dueDay).toBeUndefined();
  });

  it("marcar como paga tira a despesa de Próximos vencimentos e não muda o valor", () => {
    store().setTransactionDueDay("e1", 14);
    const data = () => ({ transactions: store().transactions, creditTransactions: [], creditCards: [] });
    expect(getUpcomingDues(data(), "2026-11-12", 14).map((d) => d.name)).toEqual(["Internet"]);
    store().setTransactionPayment("e1", "2026-11", { method: "pix", date: "2026-11-12" });
    expect(getUpcomingDues(data(), "2026-11-12", 14)).toEqual([]);
    expect(store().transactions[0].amount).toBe(12000);
  });

  it("os avisos vistos de vencimentos antigos são podados", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12));
    store().markAlertsSeen(["due:tx:e1:2026-01:overdue", "due:tx:e1:2026-11:soon", "inv:x:2026-01-01:soon"]);
    expect(store().seenAlerts).toContain("due:tx:e1:2026-11:soon");
    expect(store().seenAlerts).toContain("inv:x:2026-01-01:soon");
    expect(store().seenAlerts).not.toContain("due:tx:e1:2026-01:overdue");
    vi.useRealTimers();
  });
});

describe("etiquetas na store", () => {
  it("define, troca e tira as etiquetas, avisando o repositório (a lista inteira)", () => {
    store().setTransactionTags("e1", ["viagem", "Heitor"]);
    expect(store().transactions[0].tags).toEqual(["viagem", "Heitor"]);
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("e1", { tags: ["viagem", "Heitor"] });
    store().setTransactionTags("e1", []);
    expect(store().transactions[0].tags).toBeUndefined();
    expect(store().transactions[0].amount).toBe(12000);
    store().setTransactionTags("nao-existe", ["x"]);
    expect(repo.updateTransaction).toHaveBeenCalledTimes(2);
  });
});
