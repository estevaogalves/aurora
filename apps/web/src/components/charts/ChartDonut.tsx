import { useCallback, useRef, useState, type ReactNode } from "react";
import { formatBRL, formatBRLShort } from "@/lib/money";
import PickPopover from "./PickPopover";
import { TipBox } from "./ChartTooltip";
import { useChartTip } from "./useChartTip";

export interface DonutSlice {
  label: string;
  /** centavos */
  value: number;
  color: string;
}

/**
 * Rosca com o total no centro e legenda em percentual (protótipo B).
 * Com `renderDetail`, clicar (ou Enter) em uma fatia abre um popover pequeno com o que ele devolver.
 */
export default function ChartDonut({ slices, renderDetail }: { slices: DonutSlice[]; renderDetail?: (slice: DonutSlice) => ReactNode }) {
  const { tip, show, hide } = useChartTip();
  const box = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const closePick = useCallback(() => setPicked(null), []);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const size = 190;
  const r = size / 2 - 14;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  // o total no centro tem que caber dentro do anel: valores muito longos diminuem a letra (até um mínimo)
  const centerText = formatBRLShort(total);
  const centerFontSize = Math.max(9, Math.min(17, (17 * 124) / (centerText.length * 10.3)));

  const visible = slices.filter((s) => s.value > 0);
  const arcs = visible.map((s, i) => ({
    ...s,
    len: (s.value / total) * circ,
    offset: visible.slice(0, i).reduce((sum, v) => sum + (v.value / total) * circ, 0),
  }));

  const pickedIndex = arcs.findIndex((a) => a.label === picked);
  const pickedArc = pickedIndex >= 0 ? arcs[pickedIndex] : null;
  const angle = pickedArc ? ((pickedArc.offset + pickedArc.len / 2) / circ) * 2 * Math.PI - Math.PI / 2 : 0;
  const pick = (label: string) => { hide(); setPicked(label); };
  const pickProps = (label: string) =>
    renderDetail
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": `Ver lançamentos de ${label}`,
          onClick: () => pick(label),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(label);
            }
          },
        }
      : {};

  return (
    <div className="grid grid-cols-[minmax(150px,200px)_1fr] items-center gap-[18px] max-[480px]:grid-cols-1 max-[480px]:justify-items-center">
      <div ref={box} className="relative">
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
            className={renderDetail ? "cursor-pointer outline-none focus:outline-none focus-visible:outline-none" : undefined}
            {...pickProps(a.label)}
          />
        ))}
        <text x={c} y={c - 2} textAnchor="middle" className="fill-muted-foreground text-xs">Total</text>
        <text x={c} y={c + 18} textAnchor="middle" fontSize={centerFontSize} className="fill-foreground font-bold">{centerText}</text>
      </svg>
      {renderDetail && pickedArc && (
        <PickPopover container={box} onClose={closePick} left={c + (r + 11) * Math.cos(angle)} top={c + (r + 11) * Math.sin(angle)}>
          {renderDetail(pickedArc)}
        </PickPopover>
      )}
      </div>
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
