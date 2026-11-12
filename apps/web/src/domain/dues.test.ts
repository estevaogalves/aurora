import { describe, expect, it } from "vitest";
import { dueLabel, getDueAlerts, getUpcomingDues, type CreditCard, type Transaction } from "./index";

let n = 0;
const exp = (name: string, amount: number, month: string, dueDay: number | undefined, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${n++}`, name, amount, type: "expense", category: "Moradia", month, ...(dueDay !== undefined && { dueDay }), ...extra });
const TODAY = "2026-11-12";
const data = (transactions: Transaction[], creditCards: CreditCard[] = []) => ({ transactions, creditTransactions: [], creditCards });

describe("próximos vencimentos", () => {
  it("lista só o que tem dia de vencimento, não está pago e cai na janela, em ordem de data", () => {
    const t = [
      exp("Internet", 12000, "2026-11", 20),
      exp("Água", 8000, "2026-11", 14),
      exp("Sem dia", 5000, "2026-11", undefined),
      exp("Longe", 9000, "2026-11", 30), // depois da janela de 14 dias
    ];
    expect(getUpcomingDues(data(t), TODAY, 14).map((d) => [d.name, d.days])).toEqual([["Água", 2], ["Internet", 8]]);
    expect(getUpcomingDues(data(t), TODAY, 30).map((d) => d.name)).toEqual(["Água", "Internet", "Longe"]);
  });

  it("paga some; atrasada aparece primeiro e em destaque", () => {
    const t = [
      exp("Aluguel", 100000, "2026-11", 5), // venceu dia 5: atrasada há 7 dias
      exp("Luz", 15000, "2026-11", 13),
      exp("Gás", 7000, "2026-11", 10, { payments: { "2026-11": { method: "pix", date: "2026-11-10" } } }), // paga
    ];
    const dues = getUpcomingDues(data(t), TODAY, 14);
    expect(dues.map((d) => [d.name, d.level])).toEqual([["Aluguel", "overdue"], ["Luz", "soon"]]);
    expect(dues[0].days).toBe(-7);
  });

  it("fixa vale em todos os meses; o pagamento de um mês não vale para o seguinte; dia 31 vira o último dia do mês", () => {
    const fixed = exp("Condomínio", 30000, "2026-09", 31, { fixed: true, payments: { "2026-10": { method: "pix", date: "2026-10-31" } } });
    const dues = getUpcomingDues(data([fixed]), "2026-11-25", 14);
    // outubro paga; novembro (dia 30, último do mês) pendente
    expect(dues.map((d) => [d.month, d.date])).toEqual([["2026-11", "2026-11-30"]]);
  });

  it("atrasadas muito antigas (mais de 30 dias) saem da lista", () => {
    expect(getUpcomingDues(data([exp("Antiga", 1000, "2026-09", 1)]), TODAY, 14)).toEqual([]);
  });

  it("despesa no cartão não entra sozinha: aparece a fatura, uma vez, no vencimento, e some quando paga", () => {
    const card: CreditCard = { id: "c1", name: "Nubank", closingDay: 2, dueDay: 9 };
    const purchase = exp("Mercado", 40000, "2026-11", undefined, { cardId: "c1", purchaseDate: "2026-10-20", dueDay: 3 });
    const dues = getUpcomingDues(data([purchase], [card]), "2026-11-05", 14);
    expect(dues).toHaveLength(1);
    expect(dues[0]).toMatchObject({ kind: "invoice", id: "c1", name: "Fatura Nubank", date: "2026-11-09", amount: 40000, days: 4 });
    const paid = { ...card, payments: { "2026-11": { method: "pix" as const, date: "2026-11-08" } } };
    expect(getUpcomingDues(data([purchase], [paid]), "2026-11-05", 14)).toEqual([]);
  });

  it("alertas do sino: atrasadas e até 3 dias; a chave muda quando o nível piora", () => {
    const t = [exp("Água", 8000, "2026-11", 14), exp("Internet", 12000, "2026-11", 25), exp("Aluguel", 100000, "2026-11", 5)];
    const alerts = getDueAlerts(data(t), TODAY);
    expect(alerts.map((a) => a.name)).toEqual(["Aluguel", "Água"]);
  });

  it("textos", () => {
    expect(dueLabel(-1)).toBe("atrasada há 1 dia");
    expect(dueLabel(-3)).toBe("atrasada há 3 dias");
    expect(dueLabel(0)).toBe("vence hoje");
    expect(dueLabel(1)).toBe("vence amanhã");
    expect(dueLabel(9)).toBe("vence em 9 dias");
  });
});
