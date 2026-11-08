import { useCallback, useState } from "react";
import { formatBRL } from "@/lib/money";
import { niceTicks, shortReais as short } from "./scale";
import PickPopover from "./PickPopover";
import { TipBox } from "./ChartTooltip";
import { useChartTip } from "./useChartTip";
import { useChartWidth } from "./useChartWidth";

export interface LineSeries {
  name: string;
  /** cor CSS, ex.: "hsl(var(--inc))" */
  color: string;
  /** centavos */
  values: number[];
  area?: boolean;
}

const PAD = { l: 44, r: 10, t: 10, b: 26 };

/** Linhas com grade leve e ponto final destacado (protótipo B). Valores em centavos. */
export default function ChartLine({ labels, series, height = 230, tapDetail }: { labels: string[]; series: LineSeries[]; height?: number; /** tocar (ou clicar) em um mês abre um popover com os valores, sem precisar segurar */ tapDetail?: boolean }) {
  const { ref, width } = useChartWidth();
  const { tip, show, hide } = useChartTip();
  const [picked, setPicked] = useState<number | null>(null);
  const closePick = useCallback(() => setPicked(null), []);

  const all = series.flatMap((s) => s.values.map((v) => v / 100));
  const max = Math.max(...all, 1);
  const min = Math.min(0, ...all);
  const tk = niceTicks(Math.max(max, Math.abs(min)));
  const bottom = min < 0 ? -Math.ceil(Math.abs(min) / tk.step) * tk.step : 0;
  const top = tk.top;

  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ih - ((v - bottom) / (top - bottom)) * ih;
  const band = iw / labels.length;
  const x = (i: number) => PAD.l + band * i + band / 2;

  const gridValues: number[] = [];
  for (let v = bottom; v <= top + 1e-6; v += tk.step) gridValues.push(v);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      {width > 80 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" className={`block max-w-full overflow-visible ${tapDetail ? "select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]" : ""}`}
          onContextMenu={tapDetail ? (e) => e.preventDefault() : undefined}>
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "hsl(var(--border-strong))" : "hsl(var(--border))"} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11.5px]">{short(v)}</text>
            </g>
          ))}
          {series.map((s) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v / 100)}`);
            const last = s.values.length - 1;
            return (
              <g key={s.name}>
                {s.area && <path d={`M${x(0)},${y(0)}L${pts.join("L")}L${x(last)},${y(0)}Z`} fill={s.color} opacity={0.14} />}
                <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last)} cy={y(s.values[last] / 100)} r={4.5} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
              </g>
            );
          })}
          {labels.map((label, i) => (
            <g key={label + i}>
              <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11.5px]">{label}</text>
              <rect
                x={PAD.l + band * i}
                y={PAD.t}
                width={band}
                height={tapDetail ? height - PAD.t : ih}
                fill="transparent"
                onPointerMove={(e) =>
                  e.pointerType === "mouse" && show(e, label, series.map((s) => <div key={s.name}>{s.name}: {formatBRL(s.values[i])}</div>))
                }
                onPointerLeave={hide}
                {...(tapDetail && {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `Ver saldo de ${label}`,
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
          ))}
        </svg>
      )}
      {tapDetail && picked !== null && picked < labels.length && (
        <PickPopover container={ref} onClose={closePick} left={x(picked)} top={Math.min(...series.map((s) => y(s.values[picked] / 100)))}>
          <p className="mb-1 font-display text-[14px] font-semibold">{labels[picked]}</p>
          {series.map((s) => (
            <div key={s.name} className="flex items-baseline justify-between gap-3">
              <span>{s.name}</span>
              <b className="num">{formatBRL(s.values[picked])}</b>
            </div>
          ))}
        </PickPopover>
      )}
      <TipBox tip={tip} />
    </div>
  );
}
