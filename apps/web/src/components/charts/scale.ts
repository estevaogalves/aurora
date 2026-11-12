import { isPrivate } from "@/lib/privacy";
/** Escala "bonita" para o eixo: passo redondo e no máximo ~4 divisões. `max` em reais. */
export function niceTicks(max: number) {
  const cand = [1, 2, 2.5, 5];
  let p = 10 ** Math.floor(Math.log10(Math.max(max, 1) / 4));
  for (;;) {
    for (const c of cand) {
      if (max / (c * p) <= 4.6) {
        const step = c * p;
        const n = Math.ceil(max / step);
        return { step, n, top: n * step };
      }
    }
    p *= 10;
  }
}

/** Escalas do eixo, da maior para a menor: a partir de cada uma, o valor é dividido e leva a sigla. */
const AXIS_SCALES: [number, string][] = [
  [1e12, "tri"],
  [1e9, "bi"],
  [1e6, "mi"],
  [1e3, "mil"],
];

const oneDecimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Rótulo curto de eixo, para valores em reais: 950 -> "950", 1500 -> "1,5 mil", 15000 -> "15 mil",
 * 1500000 -> "1,5 mi", 2e9 -> "2 bi", 3e12 -> "3 tri". Passando de 10^15, notação científica ("1,5e18").
 * Tem no máximo ~8 caracteres, então nunca invade a margem do gráfico.
 */
export function shortReais(reais: number): string {
  if (isPrivate()) return "••";
  const abs = Math.abs(reais);
  const sign = reais < 0 ? "-" : "";
  if (!Number.isFinite(reais)) return "";
  if (abs >= 1e15) return `${sign}${abs.toExponential(1).replace(".0", "").replace(".", ",").replace("e+", "e")}`;
  for (let i = 0; i < AXIS_SCALES.length; i++) {
    const [div, unit] = AXIS_SCALES[i];
    if (abs < div) continue;
    const value = Math.round((abs / div) * 10) / 10;
    // 999,96 mil arredonda para 1.000 mil: passa para a escala de cima
    if (value >= 1000 && i > 0) return `${sign}${oneDecimal(abs / AXIS_SCALES[i - 1][0])} ${AXIS_SCALES[i - 1][1]}`;
    return `${sign}${oneDecimal(value)} ${unit}`;
  }
  return `${sign}${String(Math.round(abs))}`;
}

/** Largura aproximada (px) de um rótulo do eixo, na fonte de 11,5 px: dígitos, pontuação/espaço e letras. */
function labelWidth(label: string): number {
  let w = 0;
  for (const ch of label) w += /\d/.test(ch) ? 6.4 : /[\s,.-]/.test(ch) ? 3.4 : 5.8;
  return w;
}

/**
 * Margem esquerda do gráfico para caber o maior rótulo do eixo (o rótulo termina 8 px antes da grade; sobra um
 * respiro). Nunca menos que o padrão, para gráficos com valores pequenos ficarem como sempre foram.
 */
export function axisPadding(labels: string[], minimum = 44): number {
  const widest = labels.reduce((m, l) => Math.max(m, labelWidth(l)), 0);
  return Math.max(minimum, Math.ceil(widest) + 10);
}
