import { useCallback, useState, type ReactNode } from "react";
import { formatBRL } from "@/lib/money";
import { niceTicks, shortReais } from "./scale";
import PickPopover from "./PickPopover";
import { TipBox } from "./ChartTooltip";
import { useChartTip } from "./useChartTip";
import { useChartWidth } from "./useChartWidth";

export interface BarSeries {
  name: string;
  color: string;
  /** centavos */
  values: number[];
}

const PAD = { l: 44, r: 10, t: 10, b: 26 };

/**
 * Barras agrupadas com topo arredondado (protótipo B).
 * Com `renderDetail`, clicar (ou Enter) em um grupo abre um popover pequeno com o que ele devolver.
 */
export default function ChartGroupBars({ labels, series, height = 250, renderDetail }: { labels: string[]; series: BarSeries[]; height?: number; renderDetail?: (index: number) => ReactNode }) {
  const { ref, width } = useChartWidth();
  const { tip, show, hide } = useChartTip();
  const [picked, setPicked] = useState<number | null>(null);
  const closePick = useCallback(() => setPicked(null), []);

  const max = Math.max(...series.flatMap((s) => s.values.map((v) => Math.max(v, 0) / 100)), 1);
  const tk = niceTicks(max);
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ih - (v / tk.top) * ih;
  const band = iw / Math.max(labels.length, 1);
  const gap = 2;
  const bw = Math.min(28, (band * 0.7 - gap * (series.length - 1)) / series.length);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      {width > 80 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" className="block max-w-full overflow-visible">
          {Array.from({ length: tk.n + 1 }, (_, i) => i * tk.step).map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke="hsl(var(--border))" />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11.5px]">{shortReais(v)}</text>
            </g>
          ))}
          {labels.map((label, i) => {
            const groupW = bw * series.length + gap * (series.length - 1);
            const x0 = PAD.l + band * i + (band - groupW) / 2;
            return (
              <g key={label + i}>
                {series.map((s, j) => {
                  const v = Math.max(s.values[i], 0) / 100;
                  const x = x0 + j * (bw + gap);
                  const h = Math.max(2, (v / tk.top) * ih);
                  const top = PAD.t + ih - h;
                  const r = Math.min(4, bw / 2);
                  return (
                    <path
                      key={s.name}
                      d={`M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z`}
                      fill={s.color}
                    />
                  );
                })}
                <text x={PAD.l + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11.5px]">{label}</text>
                <rect
                  x={PAD.l + band * i}
                  y={PAD.t}
                  width={band}
                  height={ih}
                  fill="transparent"
                  onPointerMove={(e) => e.pointerType === "mouse" && show(e, label, series.map((s) => <div key={s.name}>{s.name}: {formatBRL(s.values[i])}</div>))}
                  onPointerLeave={hide}
                  {...(renderDetail && {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `Ver detalhes de ${label}`,
                    className: "cursor-pointer focus-visible:outline-none focus-visible:stroke-primary",
                    onClick: () => { hide(); setPicked(i); },
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPicked(i);
                      }
                    },
                  })}
                />
              </g>
            );
          })}
        </svg>
      )}
      {renderDetail && picked !== null && picked < labels.length && (
        <PickPopover container={ref} onClose={closePick} left={PAD.l + band * picked + band / 2} top={y(Math.max(...series.map((s) => Math.max(s.values[picked], 0) / 100)))}>
          {renderDetail(picked)}
        </PickPopover>
      )}
      <TipBox tip={tip} />
    </div>
  );
}
