import { formatBRL, formatBRLShort } from "@/lib/money";
import { TipBox } from "./ChartTooltip";
import { useChartTip } from "./useChartTip";

export interface DonutSlice {
  label: string;
  /** centavos */
  value: number;
  color: string;
}

/** Rosca com o total no centro e legenda em percentual (protótipo B). */
export default function ChartDonut({ slices }: { slices: DonutSlice[] }) {
  const { tip, show, hide } = useChartTip();
  const total = slices.reduce((s, d) => s + d.value, 0);
  const size = 190;
  const r = size / 2 - 14;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const visible = slices.filter((s) => s.value > 0);
  const arcs = visible.map((s, i) => ({
    ...s,
    len: (s.value / total) * circ,
    offset: visible.slice(0, i).reduce((sum, v) => sum + (v.value / total) * circ, 0),
  }));

  return (
    <div className="grid grid-cols-[minmax(150px,200px)_1fr] items-center gap-[18px] max-[480px]:grid-cols-1 max-[480px]:justify-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" className="block max-w-full">
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={22}
            strokeDasharray={`${Math.max(a.len - 2, 1)} ${circ}`}
            strokeDashoffset={-a.offset}
            transform={`rotate(-90 ${c} ${c})`}
            onPointerMove={(e) => show(e, a.label, `${formatBRL(a.value)} · ${Math.round((a.value / total) * 100)}%`)}
            onPointerLeave={hide}
          />
        ))}
        <text x={c} y={c - 2} textAnchor="middle" className="fill-muted-foreground text-xs">Total</text>
        <text x={c} y={c + 18} textAnchor="middle" className="fill-foreground text-[17px] font-bold">{formatBRLShort(total)}</text>
      </svg>
      <div className="flex min-w-0 flex-col gap-[7px]">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-2 text-[12.5px]">
            <i className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: a.color }} />
            <b className="truncate font-medium text-ink2">{a.label}</b>
            <em className="num ml-auto font-bold not-italic">{Math.round((a.value / total) * 100)}%</em>
          </div>
        ))}
      </div>
      <TipBox tip={tip} />
    </div>
  );
}
