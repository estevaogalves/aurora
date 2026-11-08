/** Lógica da calculadora: um reducer puro, sem React, para testar sem tela. */

export type Op = "+" | "-" | "*" | "/";
export type CalcKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | Op | "=" | "C" | "back" | "neg" | "%";

export interface CalcState {
  /** número em edição ou resultado, com vírgula decimal ("1234,5") */
  entry: string;
  /** primeiro operando, quando há uma operação pendente */
  acc: number | null;
  op: Op | null;
  /** o próximo dígito começa um número novo */
  fresh: boolean;
  error: boolean;
  /** linha de cima: "12 × 3 =" */
  history: string;
}

export const initialCalc: CalcState = { entry: "0", acc: null, op: null, fresh: true, error: false, history: "" };

const MAX_DIGITS = 15;
const SYMBOL: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** Evita 0,1 + 0,2 = 0,30000000000000004. */
const round = (n: number) => Number(n.toPrecision(12));
const parse = (entry: string) => Number(entry.replace(",", "."));

/** Número para o formato de edição, ou null se não cabe no visor. */
function toEntry(n: number): string | null {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return null;
  const r = round(n);
  // -0 vira 0
  return (Object.is(r, -0) ? 0 : r).toString().replace(".", ",");
}

function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? null : a / b;
  }
}

const failed = (): CalcState => ({ ...initialCalc, entry: "Erro", error: true });

export function calcReduce(prev: CalcState, key: CalcKey): CalcState {
  if (key === "C") return initialCalc;
  // depois de um erro, qualquer tecla começa do zero
  const s = prev.error ? initialCalc : prev;

  if (/^[0-9]$/.test(key)) {
    if (s.fresh) return { ...s, entry: key, fresh: false };
    if (s.entry.replace(/[-,]/g, "").length >= MAX_DIGITS) return s;
    return { ...s, entry: s.entry === "0" ? key : s.entry + key };
  }

  if (key === ",") {
    if (s.fresh) return { ...s, entry: "0,", fresh: false };
    return s.entry.includes(",") ? s : { ...s, entry: s.entry + "," };
  }

  const cur = parse(s.entry);

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    // trocar de operação sem digitar o segundo número só troca o sinal
    if (s.fresh && s.acc !== null && s.op) return { ...s, op: key, history: `${toEntry(s.acc)} ${SYMBOL[key]}` };
    let acc = cur;
    if (s.acc !== null && s.op) {
      const result = apply(s.acc, s.op, cur);
      const resolved = result === null ? null : toEntry(result);
      if (resolved === null) return failed();
      acc = parse(resolved);
    }
    const shown = toEntry(acc)!;
    return { entry: shown, acc, op: key, fresh: true, error: false, history: `${shown} ${SYMBOL[key]}` };
  }

  if (key === "=") {
    if (s.acc === null || !s.op) return { ...s, fresh: true };
    const result = apply(s.acc, s.op, cur);
    const shown = result === null ? null : toEntry(result);
    if (shown === null) return failed();
    return { entry: shown, acc: null, op: null, fresh: true, error: false, history: `${toEntry(s.acc)} ${SYMBOL[s.op]} ${toEntry(cur)} =` };
  }

  if (key === "back") {
    if (s.fresh) return s;
    const next = s.entry.slice(0, -1);
    return { ...s, entry: next === "" || next === "-" ? "0" : next };
  }

  if (key === "neg") {
    if (parse(s.entry) === 0 && !s.entry.includes(",")) return s;
    return { ...s, entry: s.entry.startsWith("-") ? s.entry.slice(1) : "-" + s.entry };
  }

  // "%": em 200 + 10% vira 20 (10% de 200); fora disso, o número dividido por 100
  const pct = s.acc !== null && (s.op === "+" || s.op === "-") ? (s.acc * cur) / 100 : cur / 100;
  const shown = toEntry(pct);
  return shown === null ? failed() : { ...s, entry: shown, fresh: false };
}

/** Texto do visor com separador de milhar: "1234567,5" -> "1.234.567,5". */
export function formatEntry(entry: string): string {
  if (entry === "Erro") return entry;
  const negative = entry.startsWith("-");
  const [int, frac] = entry.replace("-", "").split(",");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${frac !== undefined ? "," + frac : ""}`;
}

/** Tecla do teclado físico -> tecla da calculadora (null se não for dela). */
export function keyFromEvent(key: string): CalcKey | null {
  if (/^[0-9]$/.test(key)) return key as CalcKey;
  switch (key) {
    case ",": case ".": return ",";
    case "+": case "-": case "*": case "/": return key;
    case "x": case "X": return "*";
    case "Enter": case "=": return "=";
    case "Backspace": return "back";
    case "Delete": case "c": case "C": return "C";
    case "%": return "%";
    default: return null;
  }
}
