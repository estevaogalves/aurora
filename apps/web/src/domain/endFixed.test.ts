import { describe, expect, it } from "vitest";
import {
  getEndedTransactionsByMonth,
  getHiddenTransactionsByMonth,
  getMonthSummary,
  getProjection,
  getTransactionsByMonth,
  isFixedActiveIn,
  patchEndFromMonth,
  patchResumeFixed,
  patchToggleFixed,
  type Transaction,
} from "./index";

// A linha manual "Cartão": despesa fixa de valor variável, com o valor real de novembro já registrado.
const cartao: Transaction = {
  id: "c", name: "Cartão", amount: 30000, type: "expense", category: "Outros", fixed: true, variableAmount: true,
  month: "2026-06", monthlyValues: { "2026-11": 73247 },
  payments: { "2026-11": { method: "pix", date: "2026-11-09" } },
};
const aluguel: Transaction = { id: "a", name: "Aluguel", amount: 100000, type: "expense", category: "Moradia", fixed: true, month: "2026-01" };

const end = (t: Transaction, month: string) => {
  const r = patchEndFromMonth(t, month);
  if (!r.ok) throw new Error(r.error);
  return { ...t, ...r.patch };
};

describe("encerrar uma despesa fixa a partir de um mês", () => {
  it("o último mês em que vale passa a ser o anterior", () => {
    const r = patchEndFromMonth(cartao, "2026-12");
    expect(r).toEqual({ ok: true, patch: { endMonth: "2026-11" } });
    // virada de ano
    expect(patchEndFromMonth(cartao, "2027-01")).toEqual({ ok: true, patch: { endMonth: "2026-12" } });
  });

  it("vale até o último mês e some dali em diante, sem mexer nos meses anteriores", () => {
    const ended = end(cartao, "2026-12");
    expect(isFixedActiveIn(ended, "2026-06")).toBe(true);
    expect(isFixedActiveIn(ended, "2026-11")).toBe(true);
    expect(isFixedActiveIn(ended, "2026-12")).toBe(false);
    expect(isFixedActiveIn(ended, "2030-01")).toBe(false);
    // continua sem valer antes de começar
    expect(isFixedActiveIn(ended, "2026-05")).toBe(false);
  });

  it("novembro fica como estava: valor real, estimado nos outros meses e o pagamento registrado", () => {
    const ended = end(cartao, "2026-12");
    const nov = getTransactionsByMonth([ended], "2026-11")[0];
    expect(nov.amount).toBe(73247);
    expect(nov.payments?.["2026-11"]).toEqual(cartao.payments?.["2026-11"]);
    expect(getTransactionsByMonth([ended], "2026-10")[0]).toMatchObject({ amount: 30000, estimated: true });
    expect(getTransactionsByMonth([ended], "2026-12")).toEqual([]);
  });

  it("os totais de novembro não mudam; de dezembro em diante o cartão sai das despesas e da projeção", () => {
    const before = { transactions: [cartao, aluguel], creditTransactions: [] };
    const after = { transactions: [end(cartao, "2026-12"), aluguel], creditTransactions: [] };
    expect(getMonthSummary(after, "2026-11")).toEqual(getMonthSummary(before, "2026-11"));
    expect(getMonthSummary(before, "2026-11").totalExpense).toBe(73247 + 100000);
    expect(getMonthSummary(before, "2026-12").totalExpense).toBe(30000 + 100000);
    expect(getMonthSummary(after, "2026-12").totalExpense).toBe(100000);
    expect(getMonthSummary(after, "2027-03").totalExpense).toBe(100000);
    const proj = getProjection(after, [], "2026-11", 3);
    expect(proj.map((m) => m.expense)).toEqual([73247 + 100000, 100000, 100000]);
  });

  it("não encerra no mês em que a fixa começa (para isso existe Excluir) nem uma despesa comum", () => {
    expect(patchEndFromMonth(cartao, "2026-06")).toMatchObject({ ok: false });
    expect(patchEndFromMonth(cartao, "2026-01")).toMatchObject({ ok: false });
    expect(patchEndFromMonth({ ...cartao, fixed: false }, "2026-12")).toMatchObject({ ok: false });
  });

  it("reativar no mês logo depois do fim só tira o fim", () => {
    const ended = end(cartao, "2026-12");
    const back = { ...ended, ...patchResumeFixed(ended, "2026-12") };
    expect(back.endMonth).toBeUndefined();
    expect(back.hiddenMonths).toBeUndefined();
    expect(isFixedActiveIn(back, "2026-12")).toBe(true);
    expect(isFixedActiveIn(back, "2027-05")).toBe(true);
  });

  it("reativar depois do fim volta só daquele mês em diante: os meses do intervalo continuam desativados", () => {
    const ended = end(cartao, "2026-12"); // vale até novembro
    const back = { ...ended, ...patchResumeFixed(ended, "2027-02") };
    expect(back.endMonth).toBeUndefined();
    expect(back.hiddenMonths).toEqual(["2026-12", "2027-01"]);
    expect(isFixedActiveIn(back, "2026-11")).toBe(true); // antes do fim: como estava
    expect(isFixedActiveIn(back, "2026-12")).toBe(false); // intervalo
    expect(isFixedActiveIn(back, "2027-01")).toBe(false); // intervalo
    expect(isFixedActiveIn(back, "2027-02")).toBe(true); // a partir daqui
    expect(isFixedActiveIn(back, "2030-01")).toBe(true);
    // os meses do intervalo aparecem como ocultos, para poder restaurar um a um
    expect(getHiddenTransactionsByMonth([back], "2026-12")).toEqual([back]);
  });

  it("reativar mantém os meses que já estavam ocultos e não repete nenhum", () => {
    const ended = { ...end(cartao, "2026-12"), hiddenMonths: ["2026-08", "2027-01"] };
    const back = { ...ended, ...patchResumeFixed(ended, "2027-03") };
    expect(back.hiddenMonths).toEqual(["2026-08", "2026-12", "2027-01", "2027-02"]);
  });

  it("os totais seguem a reativação: o mês do intervalo continua sem o valor", () => {
    const ended = end(cartao, "2026-12");
    const back = { ...ended, ...patchResumeFixed(ended, "2027-02") };
    const sum = (m: string) => getMonthSummary({ transactions: [back], creditTransactions: [] }, m).totalExpense;
    expect([sum("2026-11"), sum("2026-12"), sum("2027-01"), sum("2027-02")]).toEqual([73247, 0, 0, 30000]);
  });

  it("sem fim, reativar não muda nada", () => {
    expect(patchResumeFixed(cartao, "2027-02")).toEqual({});
  });

  it("encerrar e ocultar um mês convivem", () => {
    const t = { ...end(cartao, "2027-01"), hiddenMonths: ["2026-12"] };
    expect(isFixedActiveIn(t, "2026-11")).toBe(true);
    expect(isFixedActiveIn(t, "2026-12")).toBe(false); // oculto
    expect(isFixedActiveIn(t, "2027-01")).toBe(false); // encerrado
  });

  it("lista as encerradas só nos meses em que já não valem", () => {
    const ended = end(cartao, "2026-12");
    expect(getEndedTransactionsByMonth([ended, aluguel], "2026-11")).toEqual([]);
    expect(getEndedTransactionsByMonth([ended, aluguel], "2026-12")).toEqual([ended]);
    expect(getEndedTransactionsByMonth([ended, aluguel], "2027-08")).toEqual([ended]);
    // antes de a fixa existir não há o que reativar
    expect(getEndedTransactionsByMonth([ended], "2026-03")).toEqual([]);
  });

  it("deixar de ser fixa tira o encerramento junto", () => {
    expect(patchToggleFixed(end(cartao, "2026-12"))).toMatchObject({ fixed: false, endMonth: undefined });
  });
});
