import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import { Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dueLabel, formatPaymentDay, goalPercent, type DueItem, type GoalAlert, type MaturityAlert } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useDueAlerts } from "@/Store/dues";
import { deadlineStatus, paceHint, useGoalAlerts } from "@/Features/Goals/goalAlerts";
import { maturityHint, maturityStatus, useMaturityAlerts } from "@/Features/Investments/maturityAlerts";

function AlertItem({ alert, seen, onToggle }: { alert: GoalAlert; seen: boolean; onToggle: () => void }) {
  return (
    <li className={`rounded-md border border-border bg-secondary p-3 ${seen ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[13.5px] font-semibold">{alert.goal.name}</span>
        <Pill tone={alert.level === "soon" ? "warn" : "bad"}>{deadlineStatus(alert)}</Pill>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-card">
        <i className="block h-full rounded-full bg-primary" style={{ width: `${goalPercent(alert.goal)}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-ink2">{goalPercent(alert.goal)}% guardado. {paceHint(alert)}</p>
      <button type="button" onClick={onToggle} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline">
        {seen ? (
          "Voltar a avisar"
        ) : (
          <>
            <Icon name="check" size={14} />
            Marcar como visto
          </>
        )}
      </button>
    </li>
  );
}

function MaturityItem({ alert, seen, onToggle }: { alert: MaturityAlert; seen: boolean; onToggle: () => void }) {
  return (
    <li className={`rounded-md border border-border bg-secondary p-3 ${seen ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[13.5px] font-semibold">{alert.investment.name}</span>
        <Pill tone={alert.level === "soon" ? "warn" : "bad"}>{maturityStatus(alert)}</Pill>
      </div>
      <p className="mt-2 text-[12.5px] text-ink2">{maturityHint(alert)}</p>
      <button type="button" onClick={onToggle} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline">
        {seen ? (
          "Voltar a avisar"
        ) : (
          <>
            <Icon name="check" size={14} />
            Marcar como visto
          </>
        )}
      </button>
    </li>
  );
}

function DueAlertItem({ item, seen, onToggle }: { item: DueItem; seen: boolean; onToggle: () => void }) {
  return (
    <li className={`rounded-md border border-border bg-secondary p-3 ${seen ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[13.5px] font-semibold">{item.name}</span>
        <Pill tone={item.level === "soon" ? "warn" : item.level === "today" ? "warn" : "bad"}>{dueLabel(item.days)}</Pill>
      </div>
      <p className="mt-2 text-[12.5px] text-ink2">{formatBRL(item.amount)} · vencimento em {formatPaymentDay(item.date)}. Marque como paga no card Próximos vencimentos do Painel.</p>
      <button type="button" onClick={onToggle} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline">
        {seen ? (
          "Voltar a avisar"
        ) : (
          <>
            <Icon name="check" size={14} />
            Marcar como visto
          </>
        )}
      </button>
    </li>
  );
}

/**
 * Sino do cabeçalho: avisos de prazo das metas, de vencimento dos investimentos e de contas a vencer (despesas com dia
 * de vencimento e faturas de cartão: atrasadas ou vencendo em até 3 dias).
 * O contador só conta o que ainda não foi visto.
 */
export default function GoalBell() {
  const goals = useGoalAlerts();
  const maturities = useMaturityAlerts();
  const dues = useDueAlerts();
  const count = goals.unseen.length + maturities.unseen.length + dues.unseen.length;
  const urgent = goals.unseen.some((a) => a.level !== "soon") || maturities.unseen.some((a) => a.level !== "soon") || dues.unseen.some((d) => d.level === "overdue" || d.level === "today");
  const none = count === 0 && goals.seen.length + maturities.seen.length + dues.seen.length === 0;
  const [open, setOpen] = useState(false);
  const markAllSeen = () => {
    goals.markSeen(goals.unseen);
    maturities.markSeen(maturities.unseen);
    dues.markSeen(dues.unseen);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count ? `Avisos de metas, investimentos e vencimentos: ${count} novos` : "Avisos de metas, investimentos e vencimentos: nenhum novo"}
          className="relative grid h-10 w-10 place-items-center sm:h-9 sm:w-9 rounded-md border border-border-strong bg-card text-foreground transition-colors hover:bg-secondary data-[state=open]:bg-secondary"
        >
          <Icon name="bell" size={16} />
          {count > 0 && (
            <span className={`absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold leading-none ${urgent ? "bg-destructive text-white" : "bg-[hsl(var(--k3))] text-[#161A2E]"}`}>
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold">Avisos</h3>
          {count > 1 && (
            <button type="button" onClick={markAllSeen} className={`${btnClass.base} ${btnClass.sm}`}>
              <Icon name="check" size={14} />
              Marcar todos como vistos
            </button>
          )}
        </div>

        {none && <p className="mt-2 text-[13px] text-muted-foreground">Nenhuma meta com prazo vencido ou chegando nos próximos 3 meses, nenhum investimento vencendo nos próximos 30 dias e nenhuma conta atrasada ou vencendo nos próximos 3 dias.</p>}
        {!none && count === 0 && <p className="mt-2 text-[13px] text-muted-foreground">Tudo visto. Nenhum aviso novo.</p>}

        <div className="mt-3 flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {goals.unseen.length > 0 && (
            <section aria-label="Prazos das metas">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Prazos das metas</p>
              <ul className="flex flex-col gap-3">
                {goals.unseen.map((a) => <AlertItem key={a.goal.id} alert={a} seen={false} onToggle={() => goals.markSeen([a])} />)}
              </ul>
            </section>
          )}
          {dues.unseen.length > 0 && (
            <section aria-label="Contas a vencer">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Contas a vencer</p>
              <ul className="flex flex-col gap-3">
                {dues.unseen.map((d) => <DueAlertItem key={d.key} item={d} seen={false} onToggle={() => dues.markSeen([d])} />)}
              </ul>
            </section>
          )}
          {maturities.unseen.length > 0 && (
            <section aria-label="Vencimentos de investimentos">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Vencimentos de investimentos</p>
              <ul className="flex flex-col gap-3">
                {maturities.unseen.map((a) => <MaturityItem key={a.investment.id} alert={a} seen={false} onToggle={() => maturities.markSeen([a])} />)}
              </ul>
            </section>
          )}
          {goals.seen.length + maturities.seen.length + dues.seen.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Já vistos</p>
              <ul className="flex flex-col gap-3">
                {goals.seen.map((a) => <AlertItem key={a.goal.id} alert={a} seen onToggle={() => goals.markUnseen(a)} />)}
                {maturities.seen.map((a) => <MaturityItem key={a.investment.id} alert={a} seen onToggle={() => maturities.markUnseen(a)} />)}
                {dues.seen.map((d) => <DueAlertItem key={d.key} item={d} seen onToggle={() => dues.markUnseen(d)} />)}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4">
          <Link to="/metas?aba=metas" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ir para Metas →</Link>
          <Link to="/metas?aba=investimentos" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ir para Investimentos →</Link>
          <Link to="/painel" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ver vencimentos →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
