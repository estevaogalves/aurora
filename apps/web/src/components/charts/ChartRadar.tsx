import { TipBox } from "./ChartTooltip";
import { useChartTip } from "./useChartTip";
import { useChartWidth } from "./useChartWidth";

export interface RadarSeries {
  name: string;
  color: string;
  /** um valor por eixo, mesma ordem de `axes` */
  values: number[];
}

/** Radar com polígonos translúcidos por mês (protótipo B). */
export default function ChartRadar({ axes, series }: { axes: string[]; series: RadarSeries[] }) {
  const { ref, width } = useChartWidth();
  const { tip, show, hide } = useChartTip();

  const size = Math.min(width, 300);
  const cx = size / 2;
  const cy = size / 2 + 4;
  const R = size / 2 - 48;
  const max = Math.max(...series.flatMap((s) => s.values), 1);

  const point = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };

  return (
    <div ref={ref} className="flex w-full min-w-0 justify-center">
      {size > 80 && (
        <svg width={size} height={size + 8} viewBox={`0 0 ${size} ${size + 8}`} role="img" className="block max-w-full">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon key={f} points={axes.map((_, i) => point(i, f).join(",")).join(" ")} fill="none" stroke="hsl(var(--border))" />
          ))}
          {axes.map((name, i) => {
            const [x, y] = point(i, 1);
            const [lx, ly] = point(i, 1.28);
            return (
              <g key={name}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" />
                <text x={lx} y={ly + 4} textAnchor="middle" className="fill-muted-foreground text-[11.5px]">{name}</text>
              </g>
            );
          })}
          {series.map((s) => (
            <polygon
              key={s.name}
              points={s.values.map((v, i) => point(i, v / max).join(",")).join(" ")}
              fill={s.color}
              fillOpacity={0.16}
              stroke={s.color}
              strokeWidth={2}
              onPointerMove={(e) => show(e, s.name, "Gastos por categoria")}
              onPointerLeave={hide}
            />
          ))}
        </svg>
      )}
      <TipBox tip={tip} />
    </div>
  );
}
