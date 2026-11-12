import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_PREFS, loadReportPrefs, parseReportPrefs, REPORT_PREFS_KEY, sameReportPrefs, saveReportPrefs, type ReportPrefs } from "./prefs";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

const mine: ReportPrefs = { format: "CSV", content: { summary: false, entries: true, invoices: true, distribution: true } };

describe("preferências do relatório", () => {
  it("sem nada salvo, vale o padrão (PDF, tudo marcado menos a sugestão de distribuição)", () => {
    expect(loadReportPrefs(fakeStorage())).toEqual(DEFAULT_REPORT_PREFS);
    expect(DEFAULT_REPORT_PREFS).toEqual({ format: "PDF", content: { summary: true, entries: true, invoices: true, distribution: false } });
  });

  it("salva e lê de volta o formato e o que está marcado", () => {
    const storage = fakeStorage();
    expect(saveReportPrefs(mine, storage)).toBe(true);
    expect(JSON.parse(storage.data[REPORT_PREFS_KEY])).toEqual(mine);
    expect(loadReportPrefs(storage)).toEqual(mine);
  });

  it("o padrão não é alterado por quem lê (cada leitura recebe a sua cópia)", () => {
    const a = loadReportPrefs(fakeStorage());
    a.content.summary = false;
    expect(loadReportPrefs(fakeStorage()).content.summary).toBe(true);
    expect(DEFAULT_REPORT_PREFS.content.summary).toBe(true);
  });

  it("texto corrompido ou de outro tipo volta ao padrão, sem erro", () => {
    for (const raw of ["", "não é json", "null", "42", "[1,2]", '"texto"', "{"]) expect(parseReportPrefs(raw)).toEqual(DEFAULT_REPORT_PREFS);
  });

  it("aceita só valores que reconhece: formato desconhecido e campos com tipo errado ficam no padrão", () => {
    expect(parseReportPrefs(JSON.stringify({ format: "DOCX", content: { summary: "sim", entries: false, invented: true } }))).toEqual({
      format: "PDF",
      content: { ...DEFAULT_REPORT_PREFS.content, entries: false },
    });
  });

  it("preferência salva antes de existir um campo novo (ex.: faturas) usa o padrão dele", () => {
    const old = JSON.stringify({ format: "TXT", content: { summary: true, entries: false, credit: true, distribution: false } });
    // o campo antigo "credit" (parcelas do crédito) foi para dentro das faturas e é ignorado
    expect(parseReportPrefs(old)).toEqual({ format: "TXT", content: { summary: true, entries: false, invoices: true, distribution: false } });
  });

  it("sem permissão para guardar (ou sem storage), não quebra", () => {
    const denied = { getItem: () => { throw new Error("negado"); }, setItem: () => { throw new Error("negado"); } };
    expect(loadReportPrefs(denied)).toEqual(DEFAULT_REPORT_PREFS);
    expect(saveReportPrefs(mine, denied)).toBe(false);
    expect(loadReportPrefs(null)).toEqual(DEFAULT_REPORT_PREFS);
    expect(saveReportPrefs(mine, null)).toBe(false);
  });

  it("compara preferências campo a campo", () => {
    expect(sameReportPrefs(mine, { ...mine, content: { ...mine.content } })).toBe(true);
    expect(sameReportPrefs(mine, { ...mine, format: "PDF" })).toBe(false);
    expect(sameReportPrefs(mine, { ...mine, content: { ...mine.content, invoices: false } })).toBe(false);
    expect(sameReportPrefs(DEFAULT_REPORT_PREFS, parseReportPrefs(null))).toBe(true);
  });
});
