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

/** 1500 -> "1,5 mil" */
export const shortReais = (reais: number) =>
  Math.abs(reais) >= 1000 ? `${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(reais);
