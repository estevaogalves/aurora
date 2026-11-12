/**
 * Valor em dinheiro por extenso ("cento e dez reais") e abreviado ("2 bi 1 mi").
 * Trabalha com texto de dígitos (não com `number`), então números de dezenas de casas não perdem nada no meio do
 * caminho. Só serve para mostrar: nenhuma conta do app passa por aqui.
 */

/** Dinheiro dividido em reais (dígitos) e centavos, pronto para escrever. */
export interface MoneyParts {
  negative: boolean;
  /** só dígitos, sem zeros à esquerda ("0" se não há reais) */
  reais: string;
  /** 0 a 99 */
  cents: number;
  /** o valor tem mais dígitos do que um número guarda com precisão: os dígitos finais viraram zero */
  approximate: boolean;
}

/** Quantos dígitos significativos um número (double) guarda com segurança. */
const SIGNIFICANT_DIGITS = 15;

const stripZeros = (digits: string) => digits.replace(/^0+(?=\d)/, "");

/**
 * Monta as partes a partir dos dígitos dos CENTAVOS ("123456" = R$ 1.234,56). Acima de 15 dígitos, os que passam
 * disso viram zero e o valor é marcado como aproximado (um double já não os guarda com precisão).
 */
export function partsFromCentsDigits(digits: string, negative = false): MoneyParts | null {
  if (!/^\d+$/.test(digits)) return null;
  let d = stripZeros(digits);
  let approximate = false;
  if (d.length > SIGNIFICANT_DIGITS) {
    const rest = d.slice(SIGNIFICANT_DIGITS);
    approximate = /[1-9]/.test(rest);
    d = d.slice(0, SIGNIFICANT_DIGITS) + "0".repeat(rest.length);
  }
  d = d.padStart(3, "0");
  return { negative, reais: stripZeros(d.slice(0, -2)), cents: Number(d.slice(-2)), approximate };
}

/**
 * Dígitos de um inteiro (double) pela representação mais curta, a mesma que o usuário digitou: 1e57 dá "1" seguido
 * de 57 zeros. (Os dígitos "exatos" do binário, como 1000...0139, seriam só ruído.)
 */
function digitsOf(n: number): string {
  const text = String(n);
  const m = text.match(/^(\d+)(?:\.(\d+))?e\+(\d+)$/);
  if (!m) return text; // até 10^21 o JavaScript já escreve todos os dígitos
  const [, int, frac = "", exp] = m;
  return int + frac + "0".repeat(Number(exp) - frac.length);
}

/** Partes de um valor em centavos (o `number` que o app guarda). null se não for um número finito. */
export function partsFromCents(cents: number): MoneyParts | null {
  if (!Number.isFinite(cents)) return null;
  return partsFromCentsDigits(digitsOf(Math.abs(Math.round(cents))), cents < 0);
}

/* ---------- por extenso ---------- */

const UNITS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** Nome (singular) e abreviação de cada grupo de três dígitos, do índice 1 (mil) em diante. */
const SCALES: [string, string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "mi"],
  ["bilhão", "bi"],
  ["trilhão", "tri"],
  ["quatrilhão", "quatri"],
  ["quintilhão", "quint"],
  ["sextilhão", "sext"],
  ["septilhão", "sept"],
  ["octilhão", "oct"],
  ["nonilhão", "non"],
  ["decilhão", "dec"],
  ["undecilhão", "undec"],
  ["duodecilhão", "duodec"],
  ["tredecilhão", "tredec"],
  ["quatordecilhão", "quatordec"],
  ["quindecilhão", "quindec"],
  ["sexdecilhão", "sexdec"],
  ["septendecilhão", "septendec"],
  ["octodecilhão", "octodec"],
  ["novemdecilhão", "novemdec"],
  ["vigintilhão", "vigint"],
];

/** Quantos grupos de três dígitos têm nome (até 10^66). */
const MAX_GROUPS = SCALES.length;

/** 0 a 99 por extenso ("vinte e um"). */
function belowHundred(n: number): string {
  if (n < 20) return UNITS[n];
  const unit = n % 10;
  return unit === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]} e ${UNITS[unit]}`;
}

/** 1 a 999 por extenso ("cento e vinte e três"; 100 é "cem"). */
function belowThousand(n: number): string {
  if (n === 100) return "cem";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return belowHundred(rest);
  return rest === 0 ? HUNDREDS[h] : `${HUNDREDS[h]} e ${belowHundred(rest)}`;
}

/** Grupos de três dígitos, do menor para o maior: "1234567" -> [567, 234, 1]. */
function groupsOf(reais: string): number[] {
  const out: number[] = [];
  for (let end = reais.length; end > 0; end -= 3) out.push(Number(reais.slice(Math.max(0, end - 3), end)));
  return out;
}

/** Inteiro (dígitos) por extenso, ou null se passa dos grupos que têm nome. */
function integerInWords(reais: string): string | null {
  if (reais === "0") return "zero";
  const groups = groupsOf(reais);
  if (groups.length > MAX_GROUPS) return null;

  const parts: { text: string; value: number }[] = [];
  for (let k = groups.length - 1; k >= 0; k--) {
    const g = groups[k];
    if (g === 0) continue;
    let text: string;
    if (k === 0) text = belowThousand(g);
    else if (k === 1) text = g === 1 ? "mil" : `${belowThousand(g)} mil`;
    else {
      const name = SCALES[k][0];
      text = g === 1 ? `um ${name}` : `${belowThousand(g)} ${name.replace(/ão$/, "ões")}`;
    }
    parts.push({ text, value: g });
  }

  // "e" antes do último grupo quando ele é menor que 100 ou múltiplo de 100 ("mil e quinhentos", "um milhão e um")
  const last = parts[parts.length - 1];
  if (parts.length > 1 && (last.value < 100 || last.value % 100 === 0)) {
    return `${parts.slice(0, -1).map((p) => p.text).join(" ")} e ${last.text}`;
  }
  return parts.map((p) => p.text).join(" ");
}

/**
 * Valor por extenso: "cento e dez reais", "um real e cinquenta centavos", "dois milhões de reais".
 * null se o valor passa dos grupos que têm nome (10^66).
 */
export function moneyInWords(parts: MoneyParts): string | null {
  const reaisWords = parts.reais === "0" ? null : integerInWords(parts.reais);
  if (parts.reais !== "0" && reaisWords === null) return null;

  const pieces: string[] = [];
  if (reaisWords !== null) {
    // "um milhão de reais": quando nada sobra abaixo dos milhões, a língua pede o "de"
    const millionsOnly = parts.reais.length > 6 && /^0{6}$/.test(parts.reais.slice(-6));
    pieces.push(`${reaisWords}${millionsOnly ? " de" : ""} ${parts.reais === "1" ? "real" : "reais"}`);
  }
  if (parts.cents > 0) pieces.push(parts.cents === 1 ? "um centavo" : `${belowHundred(parts.cents)} centavos`);
  if (pieces.length === 0) pieces.push("zero reais");

  const text = pieces.join(" e ");
  return `${parts.negative ? "menos " : ""}${parts.approximate ? "cerca de " : ""}${text}`;
}

/* ---------- abreviado ---------- */

/**
 * Só os reais, abreviados por grupo: "R$ 2 bi 1 mi", "R$ 1 mil 234". null abaixo de R$ 1.000 (não há o que abreviar).
 * Passando dos grupos que têm nome, usa notação científica: "R$ 1,00 × 10^120".
 */
export function moneyCompact(parts: MoneyParts): string | null {
  if (parts.reais.length < 4) return null;
  const sign = `${parts.negative ? "-" : ""}${parts.approximate ? "≈ " : ""}`;
  const groups = groupsOf(parts.reais);
  if (groups.length > MAX_GROUPS) {
    const exponent = parts.reais.length - 1;
    const mantissa = `${parts.reais[0]},${parts.reais.slice(1, 3).padEnd(2, "0")}`;
    return `${sign}R$ ${mantissa} × 10^${exponent}`;
  }
  const out: string[] = [];
  for (let k = groups.length - 1; k >= 0; k--) {
    if (groups[k] === 0) continue;
    out.push(k === 0 ? String(groups[k]) : `${groups[k]} ${SCALES[k][1]}`);
  }
  return `${sign}R$ ${out.join(" ")}`;
}

/** Texto longo demais para um tooltip: troca o por extenso pela forma abreviada. */
export const MAX_WORDS_CHARS = 140;

/** Abaixo disso o abreviado não acrescenta nada ao por extenso (R$ 1.000 = "mil reais" / "R$ 1 mil"). */
const COMPACT_FROM_REAIS_DIGITS = 4; // R$ 1.000

/**
 * O que o tooltip mostra: uma ou duas linhas. Abaixo de R$ 1.000: só o por extenso. A partir de R$ 1.000, o por
 * extenso e, embaixo, o abreviado. Extenso demais (ou sem nome em português): só o abreviado.
 */
export function describeMoney(parts: MoneyParts): string[] {
  const words = moneyInWords(parts);
  const compact = moneyCompact(parts);
  if (words !== null && words.length <= MAX_WORDS_CHARS) {
    return compact !== null && parts.reais.length >= COMPACT_FROM_REAIS_DIGITS ? [words, compact] : [words];
  }
  return [compact ?? words ?? ""].filter(Boolean);
}
