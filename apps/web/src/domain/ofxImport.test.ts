import { describe, expect, it } from "vitest";
import { buildImportRows, guessMapping } from "./csvImport";
import { isOfx, ofxToRows, parseOfx, purchasesAreNegative } from "./ofxImport";

// o fuso entre colchetes é montado aqui para o Tailwind não ler "[-3:BRT]" como classe e gerar CSS inválido
const TZ = "[-3" + ":BRT]";
const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261108120000${TZ}
<TRNAMT>-45.90
<FITID>abc1
<MEMO>Mercado Bom Preco
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261110
<TRNAMT>2300.00
<FITID>abc2
<NAME>Salario
<MEMO>Salario novembro
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const XML = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261102000000</DTPOSTED><TRNAMT>-120.50</TRNAMT><FITID>1</FITID><MEMO>Uber *Trip &amp; Co</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261103000000</DTPOSTED><TRNAMT>-30,00</TRNAMT><FITID>2</FITID><MEMO>Padaria</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261105000000</DTPOSTED><TRNAMT>500.00</TRNAMT><FITID>3</FITID><MEMO>Pagamento recebido</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("reconhece OFX (SGML e XML) e recusa CSV", () => {
    expect(isOfx(SGML)).toBe(true);
    expect(isOfx(XML)).toBe(true);
    expect(isOfx("Data;Descrição;Valor\n01/11/2026;Padaria;10,00")).toBe(false);
  });

  it("lê o OFX 1.x (SGML sem tags de fechamento): data sem hora e com fuso, memo e nome", () => {
    expect(parseOfx(SGML)).toEqual([
      { date: "2026-11-08", description: "Mercado Bom Preco", amount: "-45.90" },
      { date: "2026-11-10", description: "Salario novembro", amount: "2300.00" },
    ]);
  });

  it("lê o OFX 2.x (XML), decodifica &amp; e aceita vírgula decimal", () => {
    const txs = parseOfx(XML);
    expect(txs.map((t) => t.description)).toEqual(["Uber *Trip & Co", "Padaria", "Pagamento recebido"]);
    expect(txs[1].amount).toBe("-30,00");
  });

  it("ignora lançamentos sem data ou sem valor", () => {
    expect(parseOfx("<OFX><STMTTRN><TRNAMT>-1.00<MEMO>x</STMTTRN><STMTTRN><DTPOSTED>20261101<MEMO>y</STMTTRN></OFX>")).toEqual([]);
  });

  it("vira linhas que o importador de CSV entende: saída negativa é despesa, entrada é renda", () => {
    const rows = ofxToRows(parseOfx(SGML));
    const mapping = guessMapping(rows)!;
    const built = buildImportRows(rows, mapping, []);
    expect(built.skipped).toEqual([]);
    expect(built.rows.map((r) => [r.date, r.amount, r.type])).toEqual([
      ["2026-11-08", 4590, "expense"],
      ["2026-11-10", 230000, "income"],
    ]);
  });

  it("fatura de cartão: compras negativas viram positivas e o pagamento fica de fora", () => {
    const txs = parseOfx(XML);
    expect(purchasesAreNegative(txs)).toBe(true);
    const rows = ofxToRows(txs, true);
    const built = buildImportRows(rows, { ...guessMapping(rows)!, signMode: "expense" }, []);
    expect(built.rows.map((r) => [r.description, r.amount])).toEqual([["Uber *Trip & Co", 12050], ["Padaria", 3000]]);
    expect(built.skipped.map((s) => s.reason)).toEqual(["crédito ou pagamento, não é compra"]);
  });

  it("fatura com compras positivas não inverte o sinal", () => {
    expect(purchasesAreNegative([{ date: "2026-11-01", description: "a", amount: "10.00" }, { date: "2026-11-02", description: "b", amount: "5.00" }])).toBe(false);
  });
});
