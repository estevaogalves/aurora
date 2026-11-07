import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import { Pill } from "@/components/shared/Panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { goalPercent } from "@/domain";
import { deadlineStatus, paceHint, useGoalAlerts } from "@/Features/Goals/goalAlerts";

/** Sino do cabeçalho: mostra quantas metas estão com prazo vencido ou chegando. */
export default function GoalBell() {
  const alerts = useGoalAlerts();
  const count = alerts.length;
  const urgent = alerts.some((a) => a.level !== "soon");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count ? `Avisos de metas: ${count}` : "Avisos de metas: nenhum"}
          className="relative grid h-9 w-9 place-items-center rounded-md border border-border-strong bg-card text-foreground transition-colors hover:bg-secondary data-[state=open]:bg-secondary"
        >
          <Icon name="bell" size={16} />
          {count > 0 && (
            <span className={`absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold leading-none text-white ${urgent ? "bg-destructive" : "bg-[hsl(var(--k3))] !text-[#161A2E]"}`}>
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <h3 className="font-display text-[15px] font-semibold">Prazos das metas</h3>
        {count === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Nenhuma meta com prazo vencido ou chegando nos próximos 3 meses.</p>
        ) : (
          <ul className="mt-3 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.goal.id} className="rounded-md border border-border bg-secondary p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-[13.5px] font-semibold">{a.goal.name}</span>
                  <Pill tone={a.level === "soon" ? "warn" : "bad"}>{deadlineStatus(a)}</Pill>
                </div>
                <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-card">
                  <i className="block h-full rounded-full bg-primary" style={{ width: `${goalPercent(a.goal)}%` }} />
                </div>
                <p className="mt-2 text-[12.5px] text-ink2">{goalPercent(a.goal)}% guardado. {paceHint(a)}</p>
              </li>
            ))}
          </ul>
        )}
        <Link to="/metas" className="mt-3 inline-block text-[13px] font-bold text-primary">Ir para Metas →</Link>
      </PopoverContent>
    </Popover>
  );
}
