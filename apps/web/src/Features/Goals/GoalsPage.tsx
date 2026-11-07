import { useState } from "react";
import Icon from "@/components/Icon";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import { getGoalsSummary, goalMonthsLeft, goalPercent, isGoalDone } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore, type Goal } from "@/Store/FinanceStore";
import { formatMonthShort } from "@/Utils/Date";
import { ContributeDialog, GoalDialog } from "./GoalDialogs";

function deadlineLabel(deadline: string) {
  const [month, year] = formatMonthShort(deadline).split(" de ");
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${year}`;
}

function GoalCard({ goal, onContribute, onEdit, onDelete }: { goal: Goal; onContribute: () => void; onEdit: () => void; onDelete: () => void }) {
  const pct = goalPercent(goal);
  const left = goalMonthsLeft(goal);
  const done = isGoalDone(goal);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold">{goal.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {done && <Pill tone="good">Concluída</Pill>}
            {goal.deadline && <Pill>Prazo {deadlineLabel(goal.deadline)}</Pill>}
          </div>
        </div>
        <span className="num text-[28px] font-semibold">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <i className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px] text-muted-foreground">
        <span>{formatBRLShort(goal.saved)} guardados</span>
        <span>meta {formatBRLShort(goal.target)}</span>
      </div>
      <div className="border-t border-border pt-2.5 text-[12.5px] text-ink2">
        {done
          ? "Meta atingida. Parabéns!"
          : left === null
            ? "Sem aporte mensal definido para prever a conclusão."
            : `Guardando ${formatBRLShort(goal.monthly)} por mês, faltam ${left} ${left === 1 ? "mês" : "meses"}.`}
      </div>
      <div className="flex flex-wrap gap-2">
        {!done && (
          <button type="button" onClick={onContribute} className={`${btnClass.primary} ${btnClass.sm}`}>
            <Icon name="plus" size={14} />
            Aportar
          </button>
        )}
        <button type="button" onClick={onEdit} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
        <button type="button" onClick={onDelete} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
          <Icon name="trash" size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

export default function GoalsPage() {
  const goals = useFinanceStore((s) => s.goals);
  const removeGoal = useFinanceStore((s) => s.removeGoal);
  const summary = getGoalsSummary(goals);

  const [dialog, setDialog] = useState<{ goal: Goal | null } | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Cada objetivo com progresso e previsão de conclusão."
        action={
          <button type="button" onClick={() => setDialog({ goal: null })} className={`${btnClass.primary} ${btnClass.sm}`}>
            <Icon name="plus" size={16} />
            Nova meta
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard label="Metas ativas" value={String(summary.active)} hint={summary.nearlyDone ? `${summary.nearlyDone} perto de concluir` : "Nenhuma perto de concluir"} />
        <StatCard label="Já guardado" value={formatBRLShort(summary.saved)} hint={`de ${formatBRLShort(summary.target)} no total`} />
        <StatCard label="Aporte mensal" value={formatBRLShort(summary.monthly)} hint="somando as metas ativas" highlight />
      </div>

      <div className="mt-3.5">
        {goals.length === 0 ? (
          <Panel title="Nenhuma meta ainda" subtitle="Comece pelo que mais importa agora">
            <Empty>Crie uma meta, como a reserva de emergência, e acompanhe o progresso aqui.</Empty>
          </Panel>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onContribute={() => setContributing(g)} onEdit={() => setDialog({ goal: g })} onDelete={() => setDeleting(g)} />
            ))}
          </div>
        )}
      </div>

      <GoalDialog open={!!dialog} goal={dialog?.goal ?? null} onClose={() => setDialog(null)} />
      <ContributeDialog goal={contributing} onClose={() => setContributing(null)} />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `meta "${deleting.name}" (${formatBRL(deleting.saved)} guardados)` : "meta"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeGoal(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
