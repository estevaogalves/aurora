import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATES, buildImportRows, decodeCsvBytes, detectDelimiter, guessMapping, looksSensitive, markDuplicates, maskSensitive, parseAmount, parseCsv, parseDate, sensitiveColumns, suggestCategory, type Transaction } from "./index";

describe("leitura do CSV", () => {
  it("detecta ; e , e lê aspas, vírgula dentro de campo e CRLF", () => {
    const text = 'Data;Descrição;Valor\r\n08/11/2026;"Padaria; do Zé";-12,50\r\n09/11/2026;"Ele disse ""oi""";100,00\r\n';
    expect(detectDelimiter(text)).toBe(";");
    expect(parseCsv(text)).toEqual([["Data", "Descrição", "Valor"], ["08/11/2026", "Padaria; do Zé", "-12,50"], ["09/11/2026", 'Ele disse "oi"', "100,00"]]);
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
  });

  it("ignora BOM e linhas vazias", () => {
    expect(parseCsv("﻿a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("decodifica Windows-1252 quando não é UTF-8", () => {
    const bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9]); // "Café" em latin1
    expect(decodeCsvBytes(bytes.buffer)).toBe("Café");
    expect(decodeCsvBytes(new TextEncoder().encode("Café").buffer as ArrayBuffer)).toBe("Café");
  });
});

describe("valores e datas", () => {
  it("parseAmount nos formatos de banco", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("-1.234,56")).toBe(-123456);
    expect(parseAmount("R$ 10,5")).toBe(1050);
    expect(parseAmount("(10,00)")).toBe(-1000);
    expect(parseAmount("50,00-")).toBe(-5000);
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("1.234")).toBe(123400);
    expect(parseAmount("50")).toBe(5000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12,345,6")).toBeNull();
  });

  it("parseDate em vários formatos, só datas reais", () => {
    expect(parseDate("08/11/2026")).toBe("2026-11-08");
    expect(parseDate("8/1/26")).toBe("2026-01-08");
    expect(parseDate("08-11-2026")).toBe("2026-11-08");
    expect(parseDate("08.11.2026")).toBe("2026-11-08");
    expect(parseDate("2026-11-08")).toBe("2026-11-08");
    expect(parseDate("2026-11-08 14:30:00")).toBe("2026-11-08");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("amanhã")).toBeNull();
  });
});

describe("segurança: cartão, CPF e documentos", () => {
  it("reconhece e mascara número de cartão (Luhn), CPF e CNPJ", () => {
    expect(looksSensitive("COMPRA 4111 1111 1111 1111")).toBe("card");
    expect(looksSensitive("CPF 123.456.789-09")).toBe("document");
    expect(looksSensitive("PADARIA 12345")).toBeNull();
    expect(maskSensitive("PIX 123.456.789-09 JOAO")).toBe("PIX ••• JOAO");
    expect(maskSensitive("CARTAO 4111111111111111 LOJA")).toBe("CARTAO ••• LOJA");
    expect(maskSensitive("PEDIDO 1234567890123456 LOJA")).toBe("PEDIDO 1234567890123456 LOJA"); // não passa no Luhn
    expect(maskSensitive("LOJA 12.345.678/0001-95")).toBe("LOJA •••");
  });

  it("colunas inteiras com cartão ou CPF são detectadas", () => {
    const rows = [["d", "x", "doc"], ["08/11", "A", "123.456.789-09"], ["09/11", "B", "987.654.321-00"], ["10/11", "C", "111.444.777-35"]];
    expect([...sensitiveColumns(rows.slice(1)).entries()]).toEqual([[2, "document"]]);
    const cards = [["a", "4111111111111111"], ["b", "5500005555555559"]];
    expect([...sensitiveColumns(cards).entries()]).toEqual([[1, "card"]]);
    expect(sensitiveColumns([["a", "10,50"], ["b", "12,00"]]).size).toBe(0);
  });
});

describe("mapeamento e linhas", () => {
  const csv = [["Data", "Histórico", "Valor"], ["08/11/2026", "UBER *TRIP", "-23,90"], ["09/11/2026", "SALARIO", "3.000,00"], ["10/11/2026", "LINHA RUIM", "abc"], ["32/11/2026", "DATA RUIM", "5,00"]];

  it("sugere as colunas pelo cabeçalho e pelo conteúdo", () => {
    expect(guessMapping(csv)).toEqual({ date: 0, description: 1, amount: 2, hasHeader: true, signMode: "auto" });
    expect(guessMapping(csv.slice(1, 3))).toMatchObject({ date: 0, description: 1, amount: 2, hasHeader: false });
    expect(guessMapping([["a", "b"], ["c", "d"]])).toBeNull();
    // fatura no formato date,category,title,amount (Nubank): a descrição é o "title", não a "category"
    const nu = [["date", "category", "title", "amount"], ["2026-10-05", "restaurante", "Outback", "189.90"], ["2026-10-08", "transporte", "Uber", "23.90"]];
    expect(guessMapping(nu)).toMatchObject({ date: 0, description: 2, amount: 3, hasHeader: true });
  });

  it("monta as linhas: sinal define despesa ou renda, categoria vem das regras, linhas ruins são puladas", () => {
    const rules = [{ id: "r1", contains: "uber", category: "Transporte" }];
    const m = guessMapping(csv)!;
    const { rows, skipped } = buildImportRows(csv, m, rules);
    expect(rows.map((r) => [r.date, r.description, r.amount, r.type, r.category])).toEqual([
      ["2026-11-08", "UBER *TRIP", 2390, "expense", "Transporte"],
      ["2026-11-09", "SALARIO", 300000, "income", "Renda"],
    ]);
    expect(skipped).toEqual([{ line: 4, reason: "valor inválido" }, { line: 5, reason: "data inválida" }]);
  });

  it("modo fatura: tudo é despesa, mesmo com valores positivos", () => {
    const fatura = [["Data", "Descrição", "Valor"], ["05/11/2026", "MERCADO", "150,00"]];
    const { rows } = buildImportRows(fatura, { ...guessMapping(fatura)!, signMode: "expense" }, []);
    expect(rows[0]).toMatchObject({ type: "expense", amount: 15000, category: "Outros" });
  });

  it("fatura: pagamento e estorno (valor negativo) não viram despesa", () => {
    const fatura = [["Data", "Descrição", "Valor"], ["05/11/2026", "MERCADO", "150,00"], ["06/11/2026", "Pagamento recebido", "-500,00"]];
    const { rows, skipped } = buildImportRows(fatura, { ...guessMapping(fatura)!, signMode: "expense" }, []);
    expect(rows).toHaveLength(1);
    expect(skipped).toEqual([{ line: 3, reason: "crédito ou pagamento, não é compra" }]);
  });

  it("regras de categoria ignoram acento e maiúscula", () => {
    expect(suggestCategory("Pão de Açúcar", [{ id: "1", contains: "PAO DE ACUCAR", category: "Alimentação" }])).toBe("Alimentação");
    expect(suggestCategory("Outra coisa", [])).toBe("Outros");
  });

  it("dados sensíveis na descrição saem mascarados", () => {
    const rows = [["Data", "Descrição", "Valor"], ["05/11/2026", "PIX 123.456.789-09 JOAO", "-10,00"]];
    expect(buildImportRows(rows, guessMapping(rows)!, []).rows[0].description).toBe("PIX ••• JOAO");
  });
});

describe("duplicados e reimportação", () => {
  const rows = [["Data", "Descrição", "Valor"], ["05/11/2026", "Café", "-10,00"], ["05/11/2026", "Café", "-10,00"], ["06/11/2026", "Livro", "-50,00"]];
  const built = () => buildImportRows(rows, guessMapping(rows)!, []).rows;
  const existing = (extra: Partial<Transaction>): Transaction => ({ id: "x", name: "Livro", amount: 5000, type: "expense", category: "Outros", month: "2026-11", ...extra });

  it("duas linhas iguais no mesmo arquivo são duas compras (cada uma tem a sua chave)", () => {
    const r = built();
    expect(r[0].key).not.toBe(r[1].key);
    expect(markDuplicates(r, [], new Set()).some((x) => x.duplicate)).toBe(false);
  });

  it("casa com lançamento já existente (mesmo mês, valor e nome) e com compra de cartão (mesmo dia)", () => {
    const r = markDuplicates(built(), [existing({})], new Set());
    expect(r.map((x) => x.duplicate)).toEqual([false, false, true]);
    const card = markDuplicates(built(), [existing({ name: "Café", amount: 1000, cardId: "c", purchaseDate: "2026-11-05" })], new Set());
    // só uma das duas linhas iguais casa com a compra existente
    expect(card.map((x) => x.duplicate)).toEqual([true, false, false]);
  });

  it("reimportar o mesmo arquivo não duplica: as chaves já importadas marcam tudo", () => {
    const first = built();
    const keys = new Set(first.map((x) => x.key));
    expect(markDuplicates(built(), [], keys).every((x) => x.duplicate)).toBe(true);
  });
});

describe("planilhas modelo", () => {
  for (const t of IMPORT_TEMPLATES) {
    it(`${t.id}: só o cabeçalho, sem exemplos, e o app reconhece as colunas`, () => {
      const rows = parseCsv(t.content);
      expect(rows).toEqual([["Data", "Descrição", "Valor"]]);
      expect(guessMapping(rows)).toMatchObject({ date: 0, description: 1, amount: 2, hasHeader: true });
      expect(t.filename).toMatch(/\.csv$/);
    });

    it(`${t.id}: o modelo preenchido pela pessoa é lido sem pular nenhuma linha`, () => {
      const filled = `${t.content}03/11/2026;SUPERMERCADO;${t.id === "fatura" ? "187,43" : "-187,43"}\r\n05/11/2026;PADARIA;${t.id === "fatura" ? "12,50" : "-12,50"}\r\n`;
      const rows = parseCsv(filled);
      const { rows: built, skipped } = buildImportRows(rows, { ...guessMapping(rows)!, signMode: t.id === "fatura" ? "expense" : "auto" }, []);
      expect(skipped).toEqual([]);
      expect(built.map((r) => r.type)).toEqual(["expense", "expense"]);
    });
  }
});
