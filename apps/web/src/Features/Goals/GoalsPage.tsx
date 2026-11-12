import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "@/components/Icon";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import { getGoalsSummary, type GoalAlert, type GoalMovement, goalDeadlinePlan, goalForecast, goalMonthsLeft, goalPercent, isGoalDone, piggyAtDeadline } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore, type Goal } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { formatMonthShort, getCurrentMonth } from "@/Utils/Date";
import InvestmentsView from "../Investments/InvestmentsView";
import SimulatorView from "../Investments/SimulatorView";
import { INVESTIMENTOS_TOUR, SIMULADOR_TOUR } from "../Investments/tour";
import { getDemoGoals } from "./demo";
import { GoalDialog, GoalHistoryDialog, GoalMovementDialog } from "./GoalDialogs";
import { deadlineStatus, useGoalAlerts } from "./goalAlerts";
import { METAS_TOUR } from "./tour";

function deadlineLabel(deadline: string) {
  const [month, year] = formatMonthShort(deadline).split(" de ");
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${year}`;
}

const noop = () => {};
const plural = (n: number) => `${n} ${n === 1 ? "mês" : "meses"}`;

/** Previsão da meta. Com prazo, recomenda o aporte mensal que o cumpre; sem prazo, prevê pelo aporte informado. */
function Forecast({ goal, done }: { goal: Goal; done: boolean }) {
  const allMovements = useFinanceStore((s) => s.goalMovements);
  if (done) return <>Meta atingida. Parabéns!</>;

  const plan = goalDeadlinePlan(goal, getCurrentMonth());
  const left = goalMonthsLeft(goal);
  // no ritmo dos últimos aportes (média dos últimos 3 meses); sem aportes, vale o aporte mensal definido
  const pace = goalForecast(goal, allMovements, getCurrentMonth());
  const paceLine = pace?.basis === "history" && (
    <span>No ritmo dos últimos aportes (média de <b className="num text-foreground">{formatBRLShort(pace.perMonth)}</b> por mês), você conclui em {plural(pace.months)} ({deadlineLabel(pace.month)}).</span>
  );

  if (plan) {
    if (plan.monthsLeft <= 0) {
      return <>{plan.monthsLeft === 0 ? "O prazo é neste mês" : "O prazo já passou"}: faltam {formatBRLShort(plan.recommended)}.</>;
    }
    return (
      <div className="flex flex-col gap-1">
        <span>Para chegar no prazo ({plural(plan.monthsLeft)}), junte cerca de <b className="num text-foreground">{formatBRLShort(plan.recommended)}</b> por mês.</span>
        {paceLine}
        {plan.covered === true && <span className="text-success">Seu aporte de {formatBRLShort(goal.monthly)} por mês cobre o prazo.</span>}
        {plan.covered === false && (
          <span className="font-semibold text-destructive">
            Seu aporte de {formatBRLShort(goal.monthly)} por mês não basta para o prazo{left !== null && `: nesse ritmo a meta leva ${plural(left)}`}.
          </span>
        )}
      </div>
    );
  }

  if (left === null) return paceLine || <>Defina um aporte mensal para prever.</>;
  return (
    <div className="flex flex-col gap-1">
      <span>Guardando {formatBRLShort(goal.monthly)} por mês, faltam {plural(left)}.</span>
      {paceLine}
    </div>
  );
}

function GoalCard({ goal, alert, first, onContribute, onHistory, onEdit, onDelete }: { goal: Goal; alert?: GoalAlert; first?: boolean; onContribute: () => void; onHistory: () => void; onEdit: () => void; onDelete: () => void }) {
  const pct = goalPercent(goal);
  const done = isGoalDone(goal);

  return (
    <article data-tour={first ? "meta" : undefined} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold">{goal.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {done && <Pill tone="good">Concluída</Pill>}
            {goal.deadline && <Pill>Prazo {deadlineLabel(goal.deadline)}</Pill>}
            {alert && <Pill tone={alert.level === "soon" ? "warn" : "bad"}>{deadlineStatus(alert)}</Pill>}
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
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Rendimentos acumulados</span>
        <b className={`num ${(goal.yieldTotal ?? 0) > 0 ? "text-success" : "text-muted-foreground"}`}>{formatBRL(goal.yieldTotal ?? 0)}</b>
      </div>
      <div className="border-t border-border pt-2.5 text-[12.5px] text-ink2">
        <Forecast goal={goal} done={done} />
      </div>
      <div data-tour={first ? "meta-acoes" : undefined} className="flex flex-wrap gap-2">
        {!done && (
          <button type="button" onClick={onContribute} className={`${btnClass.primary} ${btnClass.sm}`}>
            <Icon name="plus" size={14} />
            Aportar
          </button>
        )}
        <button type="button" onClick={onHistory} className={`${btnClass.base} ${btnClass.sm}`}>Histórico</button>
        <button type="button" onClick={onEdit} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
        <button type="button" onClick={onDelete} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
          <Icon name="trash" size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

/** Porquinho: guardado sem valor de meta, só com o que já tem, o aporte, o rendimento e o prazo. */
function PiggyCard({ goal, onContribute, onHistory, onEdit, onDelete }: { goal: Goal; onContribute: () => void; onHistory: () => void; onEdit: () => void; onDelete: () => void }) {
  const projected = piggyAtDeadline(goal, getCurrentMonth());

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold">{goal.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill>Porquinho</Pill>
            {goal.deadline && <Pill>Prazo {deadlineLabel(goal.deadline)}</Pill>}
          </div>
        </div>
        <span className="num text-[22px] font-semibold">{formatBRLShort(goal.saved)}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Aporte mensal</span>
        <b className="num">{goal.monthly > 0 ? formatBRL(goal.monthly) : "—"}</b>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Rendimentos acumulados</span>
        <b className={`num ${(goal.yieldTotal ?? 0) > 0 ? "text-success" : "text-muted-foreground"}`}>{formatBRL(goal.yieldTotal ?? 0)}</b>
      </div>
      {projected !== null && (
        <div className="border-t border-border pt-2.5 text-[12.5px] text-ink2">
          Guardando {formatBRLShort(goal.monthly)} por mês, você terá cerca de <b className="num text-foreground">{formatBRLShort(projected)}</b> até {deadlineLabel(goal.deadline!)}, sem contar rendimentos.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onContribute} className={`${btnClass.primary} ${btnClass.sm}`}>
          <Icon name="plus" size={14} />
          Aportar
        </button>
        <button type="button" onClick={onHistory} className={`${btnClass.base} ${btnClass.sm}`}>Histórico</button>
        <button type="button" onClick={onEdit} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
        <button type="button" onClick={onDelete} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
          <Icon name="trash" size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

function GoalsView() {
  const goals = useFinanceStore((s) => s.goals);
  const mainGoals = goals.filter((g) => !g.piggy);
  const piggies = goals.filter((g) => g.piggy);
  // durante o tour, quem não criou metas vê um cartão de exemplo além do aviso de lista vazia
  const demo = useUiStore((s) => s.tourDemo) && goals.length === 0;
  const demoGoals = useMemo(() => (demo ? getDemoGoals() : []), [demo]);
  const removeGoal = useFinanceStore((s) => s.removeGoal);
  const summary = getGoalsSummary(goals);
  const { all: alerts } = useGoalAlerts();

  const [editing, setEditing] = useState<Goal | null>(null);
  // a meta fica guardada ao fechar para o título não piscar vazio durante a animação
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  // histórico aberto e movimentação em edição (a meta fica guardada para o título não piscar vazio ao fechar)
  const [history, setHistory] = useState<Goal | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<GoalMovement | null>(null);
  const openHistory = (g: Goal) => { setHistory(g); setHistoryOpen(true); };
  const fresh = (g: Goal | null) => (g ? goals.find((x) => x.id === g.id) ?? g : null);

  return (
    <>
      <PageHeader tour={METAS_TOUR} title="Metas" subtitle="Cada objetivo com progresso e previsão de conclusão. Para criar uma meta, use o botão Lançar." />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard tour="ativas" label="Metas ativas" value={String(summary.active)} hint={summary.nearlyDone ? `${summary.nearlyDone} perto de concluir` : "Nenhuma perto de concluir"} />
        <StatCard tour="guardado" label="Já guardado" value={formatBRLShort(summary.saved)} hint={`de ${formatBRLShort(summary.target)} no total`} />
        <StatCard tour="aporte" label="Aporte mensal" value={formatBRLShort(summary.monthly)} hint="somando as metas ativas" highlight />
      </div>

      <div className="mt-3.5">
        {goals.length === 0 ? (
          <>
            <Panel tour="vazio" title="Nenhuma meta ainda" subtitle="Comece pelo que mais importa agora">
              <Empty>Use Lançar → Meta para criar uma, como a reserva de emergência, e acompanhe o progresso aqui.</Empty>
            </Panel>
            {demoGoals.length > 0 && (
              <>
                <p role="note" className="mb-3.5 mt-3.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                  <b className="text-foreground">Exemplo ilustrativo.</b> Estas metas são fictícias, só para mostrar como o cartão fica depois que você criar a sua.
                </p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
                  {demoGoals.map((g, i) => (
                    <GoalCard key={g.id} first={i === 0} goal={g} onContribute={noop} onHistory={noop} onEdit={noop} onDelete={noop} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : mainGoals.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {mainGoals.map((g, i) => (
              <GoalCard key={g.id} first={i === 0} goal={g} alert={alerts.find((a) => a.goal.id === g.id)} onContribute={() => { setContributing(g); setContributeOpen(true); }} onHistory={() => openHistory(g)} onEdit={() => setEditing(g)} onDelete={() => setDeleting(g)} />
            ))}
          </div>
        )}
      </div>

      {/* porquinhos ficam sempre abaixo das metas principais */}
      {piggies.length > 0 && (
        <section data-tour="porquinhos" className="mt-6">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold">Porquinhos</h3>
            <span className="text-[12.5px] text-muted-foreground">
              {piggies.length} {piggies.length === 1 ? "porquinho" : "porquinhos"} · {formatBRL(piggies.reduce((s, g) => s + g.saved, 0))} guardados
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {piggies.map((g) => (
              <PiggyCard key={g.id} goal={g} onContribute={() => { setContributing(g); setContributeOpen(true); }} onHistory={() => openHistory(g)} onEdit={() => setEditing(g)} onDelete={() => setDeleting(g)} />
            ))}
          </div>
        </section>
      )}

      <GoalDialog open={!!editing} goal={editing} onClose={() => setEditing(null)} />
      <GoalMovementDialog goal={fresh(contributing)} open={contributeOpen} onClose={() => setContributeOpen(false)} />
      <GoalHistoryDialog goal={fresh(history)} open={historyOpen && !editingMovement} onClose={() => setHistoryOpen(false)} onEdit={setEditingMovement} />
      <GoalMovementDialog goal={fresh(history)} movement={editingMovement} open={!!editingMovement} onClose={() => setEditingMovement(null)} />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `${deleting.piggy ? "porquinho" : "meta"} "${deleting.name}" (${formatBRL(deleting.saved)} guardados)` : "meta"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeGoal(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}

type View = "metas" | "investimentos" | "simulador";

/** Tela Metas e Investimentos: o seletor no topo alterna entre as duas visões, sem ocupar uma aba nova. */
export default function GoalsPage() {
  // o sino abre direto na visão certa com /metas?aba=metas ou /metas?aba=investimentos (a cada navegação,
  // mesmo já estando na tela). Sem o parâmetro, a visão escolhida no seletor fica como está.
  const { key, search } = useLocation();
  const aba = new URLSearchParams(search).get("aba");
  const requested: View | null = aba === "investimentos" ? "investimentos" : aba === "simulador" ? "simulador" : aba === "metas" ? "metas" : null;
  const [view, setView] = useState<View>(requested ?? "metas");
  const [lastNav, setLastNav] = useState(key);
  if (key !== lastNav) {
    setLastNav(key);
    if (requested) setView(requested);
  }
  const options: { id: View; label: string }[] = [
    { id: "metas", label: "Metas" },
    { id: "investimentos", label: "Investimentos" },
    { id: "simulador", label: "Simulador" },
  ];

  return (
    <>
      <div role="tablist" aria-label="Metas, investimentos ou simulador" className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={view === o.id}
            onClick={() => setView(o.id)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors max-sm:min-h-10 ${view === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {view === "metas" ? (
        <GoalsView />
      ) : view === "simulador" ? (
        <>
          <PageHeader tour={SIMULADOR_TOUR} title="Simulador" subtitle="Veja como um aporte mensal cresce com juros compostos e quanto poderia render em dividendos, com a taxa que você escolher." />
          <SimulatorView />
        </>
      ) : (
        <>
          <PageHeader tour={INVESTIMENTOS_TOUR} title="Investimentos" subtitle="Registro manual do que você tem investido: valores e prazos ficam como você informar, sem ligação com bancos ou corretoras." />
          <InvestmentsView />
        </>
      )}
    </>
  );
}
