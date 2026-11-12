import type { Category } from "../Types/Category";
import type { Transaction } from "./types";

/**
 * Importar CSV de extrato ou fatura. Tudo roda no navegador, com o texto do arquivo em memória (o arquivo nunca é
 * guardado). Nada vira lançamento antes do usuário confirmar a pré-visualização. Dinheiro em centavos.
 */

/** Limites: arquivo e linhas. Acima disso o arquivo é recusado (evita travar a tela). */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;

/* ---------- leitura do arquivo ---------- */

/** Texto do arquivo: UTF-8 e, se não for válido (bancos costumam exportar em Windows-1252), Windows-1252. */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Separador mais provável (";", "," ou tabulação) pela primeira linha com mais campos. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  let best = ",";
  let bestScore = 0;
  for (const d of [";", "\t", ","]) {
    const counts = lines.map((l) => splitLine(l, d).length);
    // consistente entre as linhas e com mais de 1 campo
    const min = Math.min(...counts);
    if (min > 1 && min * lines.length > bestScore) {
      best = d;
      bestScore = min * lines.length;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  return parseCsv(line, delimiter)[0] ?? [];
}

/** CSV com aspas ("a;b" dentro de campo, "" para aspas) e quebras de linha CRLF ou LF. Linhas totalmente vazias saem. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== "")).map((r) => r.map((f) => f.trim()));
}

/* ---------- valores ---------- */

/** "1.234,56", "-50,00", "R$ 10", "(10,00)", "50,00-", "1,234.56" e "1234.56" -> centavos com sinal; null se não for valor. */
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/R\$/gi, "").replace(/\s| /g, "");
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) { negative = true; t = t.slice(1, -1); }
  if (t.endsWith("-")) { negative = true; t = t.slice(0, -1); }
  if (t.startsWith("-")) { negative = true; t = t.slice(1); }
  else if (t.startsWith("+")) t = t.slice(1);
  if (!/^\d[\d.,]*$/.test(t)) return null;

  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // o último separador é o decimal
    normalized = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // só vírgula: decimal (1 ou 2 casas) ou milhar (3 casas, ex.: 1,234)
    normalized = /,\d{3}$/.test(t) && t.split(",").length > 1 && !/,\d{1,2}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  } else normalized = t;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** "08/11/2026", "08/11/26", "08-11-2026", "08.11.2026" e "2026-11-08" (com ou sem hora) -> "AAAA-MM-DD"; null se inválida. */
export function parseDate(raw: string): string | null {
  const t = raw.trim().split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else if ((match = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    d = +match[1]; m = +match[2]; y = +match[3];
    if (match[3].length === 2) y += 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ---------- segurança: cartão, CPF e documentos ---------- */

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

const CPF_FORMATTED = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g;
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;

/** O texto parece ter número de cartão (13 a 19 dígitos que passam no teste de Luhn), CPF ou CNPJ formatados? */
export function looksSensitive(text: string): "card" | "document" | null {
  for (const m of text.match(CARD_RE) ?? []) {
    const d = onlyDigits(m);
    if (d.length >= 13 && d.length <= 19 && luhn(d)) return "card";
  }
  if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(text) || /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/.test(text)) return "document";
  return null;
}

/** Troca por "•••" o que parece número de cartão, CPF ou CNPJ numa descrição, para nunca entrar nos lançamentos. */
export function maskSensitive(text: string): string {
  return text
    .replace(CNPJ_RE, "•••")
    .replace(CPF_FORMATTED, "•••")
    .replace(CARD_RE, (m) => (luhn(onlyDigits(m)) && onlyDigits(m).length >= 13 ? "•••" : m));
}

/** Colunas inteiras que parecem guardar número de cartão ou documento (a maioria das linhas): são ignoradas. */
export function sensitiveColumns(rows: string[][]): Map<number, "card" | "document"> {
  const out = new Map<number, "card" | "document">();
  const width = Math.max(0, ...rows.map((r) => r.length));
  for (let c = 0; c < width; c++) {
    const values = rows.map((r) => r[c] ?? "").filter(Boolean);
    if (values.length === 0) continue;
    const hits = values.map((v) => {
      const digits = onlyDigits(v);
      if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(v) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v)) return "document" as const;
      // célula que é só um número comprido (sem vírgula/ponto de valor): cartão ou documento
      if (/^[\d .-]+$/.test(v) && !/[.,]\d{1,2}$/.test(v)) {
        if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return "card" as const;
        if (digits.length === 11 || digits.length === 14) return "document" as const;
      }
      return null;
    });
    const found = hits.filter(Boolean);
    if (found.length >= Math.max(1, Math.ceil(values.length / 2))) out.set(c, found[0]!);
  }
  return out;
}

/* ---------- mapeamento de colunas ---------- */

export type SignMode = "auto" | "expense" | "income";

/** Qual coluna é qual. `signMode`: "auto" = negativo é despesa e positivo é renda; "expense"/"income" = tudo é desse tipo. */
export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  hasHeader: boolean;
  signMode: SignMode;
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const DATE_NAMES = ["data", "date", "dt", "vencimento"];
const DESC_NAMES = ["descricao", "descri", "historico", "lancamento", "estabelecimento", "titulo", "title", "merchant", "memo", "detalhe", "description", "nome"];
const AMOUNT_NAMES = ["valor", "amount", "quantia", "montante", "value"];

/** Sugere o mapeamento pelo cabeçalho (ou pelo conteúdo, sem cabeçalho). null se não achar data e valor. */
export function guessMapping(rows: string[][]): ColumnMapping | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const hasHeader = !first.some((f) => parseDate(f) !== null) && !first.some((f) => parseAmount(f) !== null && /\d/.test(f) && /[,.]/.test(f));
  const header = hasHeader ? first.map(plain) : [];
  const body = hasHeader ? rows.slice(1) : rows;
  const find = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  let date = hasHeader ? find(DATE_NAMES) : -1;
  let amount = hasHeader ? find(AMOUNT_NAMES) : -1;
  let description = hasHeader ? find(DESC_NAMES) : -1;
  const width = Math.max(...rows.map((r) => r.length));
  const share = (col: number, ok: (s: string) => boolean) => {
    const v = body.map((r) => r[col] ?? "").filter(Boolean);
    return v.length ? v.filter(ok).length / v.length : 0;
  };
  if (date < 0) for (let c = 0; c < width; c++) if (share(c, (s) => parseDate(s) !== null) >= 0.8) { date = c; break; }
  if (amount < 0) for (let c = width - 1; c >= 0; c--) if (c !== date && share(c, (s) => parseAmount(s) !== null) >= 0.8) { amount = c; break; }
  if (description < 0) for (let c = 0; c < width; c++) if (c !== date && c !== amount && share(c, (s) => parseAmount(s) === null && parseDate(s) === null) >= 0.8) { description = c; break; }
  if (date < 0 || amount < 0 || description < 0) return null;
  return { date, description, amount, hasHeader, signMode: "auto" };
}

/* ---------- categorias por regras ---------- */

/** Regra do usuário: descrição que contém o texto (sem acento nem maiúscula) vai para a categoria. */
export interface CategoryRule {
  id: string;
  contains: string;
  category: Category;
}

/** Categoria da primeira regra que casa com a descrição; `fallback` se nenhuma casar. */
export function suggestCategory(description: string, rules: CategoryRule[], fallback: Category = "Outros"): Category {
  const d = plain(description);
  return rules.find((r) => r.contains.trim() && d.includes(plain(r.contains)))?.category ?? fallback;
}

/* ---------- linhas da pré-visualização ---------- */

export interface ImportRow {
  /** linha no arquivo (começa em 1, contando o cabeçalho) */
  line: number;
  date: string;
  description: string;
  /** centavos, sempre positivo */
  amount: number;
  type: "income" | "expense";
  category: Category;
  /** chave para detectar duplicados (data, valor e descrição, com o número da ocorrência) */
  key: string;
  /** já existe (ou já foi importado antes) */
  duplicate: boolean;
}

export interface BuildResult {
  rows: ImportRow[];
  /** linhas que não deram para ler, com o motivo */
  skipped: { line: number; reason: string }[];
}

/** Impressão digital de uma linha: data, valor e descrição normalizados. */
export const rowFingerprint = (date: string, amount: number, description: string) => `${date}|${amount}|${plain(description).replace(/\s+/g, " ")}`;

/** Monta as linhas da pré-visualização a partir do CSV e do mapeamento. Nada é gravado. */
export function buildImportRows(rows: string[][], mapping: ColumnMapping, rules: CategoryRule[]): BuildResult {
  const out: ImportRow[] = [];
  const skipped: BuildResult["skipped"] = [];
  const seen = new Map<string, number>();
  const start = mapping.hasHeader ? 1 : 0;

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const date = parseDate(r[mapping.date] ?? "");
    const signed = parseAmount(r[mapping.amount] ?? "");
    const description = maskSensitive((r[mapping.description] ?? "").replace(/\s+/g, " ").trim()).slice(0, 60);
    if (!date) { skipped.push({ line, reason: "data inválida" }); continue; }
    if (signed === null) { skipped.push({ line, reason: "valor inválido" }); continue; }
    if (signed === 0) { skipped.push({ line, reason: "valor zero" }); continue; }
    // fatura (tudo é despesa): valor negativo é pagamento da fatura ou estorno, não é compra
    if (mapping.signMode === "expense" && signed < 0) { skipped.push({ line, reason: "crédito ou pagamento, não é compra" }); continue; }
    if (!description) { skipped.push({ line, reason: "sem descrição" }); continue; }

    const type: ImportRow["type"] = mapping.signMode === "expense" ? "expense" : mapping.signMode === "income" ? "income" : signed < 0 ? "expense" : "income";
    const amount = Math.abs(signed);
    const fp = rowFingerprint(date, amount, description);
    const n = (seen.get(fp) ?? 0) + 1;
    seen.set(fp, n);
    out.push({ line, date, description, amount, type, category: type === "income" ? "Renda" : suggestCategory(description, rules), key: `${fp}#${n}`, duplicate: false });
  }
  return { rows: out, skipped };
}

/**
 * Marca as linhas que já existem. Compara data, valor e descrição com os lançamentos avulsos de hoje (o mês e, nas compras
 * no cartão, o dia da compra) e com as chaves de importações anteriores. Duas linhas iguais no mesmo arquivo são
 * duas compras: cada uma casa com uma só ocorrência.
 */
export function markDuplicates(rows: ImportRow[], transactions: Transaction[], importedKeys: Set<string>): ImportRow[] {
  const existing = new Map<string, number>();
  for (const t of transactions) {
    if (t.fixed) continue;
    const day = t.purchaseDate;
    const k = (date: string) => `${t.type}|${rowFingerprint(date, t.amount, t.name)}`;
    // sem o dia (despesa comum), vale o mês: marca todas as datas daquele mês como possíveis iguais
    const key = day ? k(day) : `${t.type}|month:${t.month}|${t.amount}|${plain(t.name).replace(/\s+/g, " ")}`;
    existing.set(key, (existing.get(key) ?? 0) + 1);
  }
  const used = new Map<string, number>();
  return rows.map((r) => {
    const dayKey = `${r.type}|${rowFingerprint(r.date, r.amount, r.description)}`;
    const monthKey = `${r.type}|month:${r.date.slice(0, 7)}|${r.amount}|${plain(r.description).replace(/\s+/g, " ")}`;
    for (const k of [dayKey, monthKey]) {
      const total = existing.get(k) ?? 0;
      const taken = used.get(k) ?? 0;
      if (taken < total) { used.set(k, taken + 1); return { ...r, duplicate: true }; }
    }
    return { ...r, duplicate: importedKeys.has(r.key) };
  });
}
