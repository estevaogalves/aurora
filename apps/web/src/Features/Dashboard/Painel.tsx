import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChartDonut from "@/components/charts/ChartDonut";
import ChartLine from "@/components/charts/ChartLine";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader } from "@/components/shared/Panel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { distributeBalance, getMonthSummary, goalPercent } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { useCategoryTotals, useDistributionItems, useMonthCredit, useMonthSummary, useMonthTransactions } from "@/Store/selectors";
import { useCategoryColor } from "@/Utils/categoryColors";
import { changeMonth, formatMonthShort, formatMonthTitle, getMonthName } from "@/Utils/Date";
import { ExpenseStaticRow, type ExpenseLine } from "../Launch/rows";
import { deadlineStatus, paceHint, useGoalAlerts } from "../Goals/goalAlerts";
import { getDemoGoals } from "../Goals/demo";
import { DistributionDialog } from "./DistributionDialog";
import { PAINEL_TOUR } from "./tour";

/** Cor da fatia pela posição na lista (repete depois de 9). */
const sliceColor = (items: { id: string }[], id: string) => `hsl(var(--k${(items.findIndex((i) => i.id === id) % 9) + 1}))`;

function Hero() {
  const month = useFinanceStore((s) => s.currentMonth);
  const { totalIncome, totalExpense, balance, expensePercentage } = useMonthSummary();
  const pct = Math.round(expensePercentage);

  return (
    <section data-tour="saldo" className="flex flex-col gap-1.5 rounded-lg border border-border-strong bg-[linear-gradient(155deg,color-mix(in_srgb,hsl(var(--primary))_38%,hsl(var(--card))),hsl(var(--card))_70%)] p-6 shadow-[var(--shadow-card)]">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink2">Saldo de {getMonthName(month)}</span>
      <span className={`num text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] max-[700px]:text-[34px] ${balance < 0 ? "text-destructive" : ""}`}>
        {formatBRL(balance)}
      </span>
      <span className="text-[13.5px] text-ink2">{pct}% da renda comprometida</span>
      <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-background/50">
        <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {[
          ["Renda", totalIncome],
          ["Despesas", totalExpense],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-background/40 px-3 py-2.5">
            <small className="block text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{label}</small>
            <b className="num text-base">{formatBRLShort(value as number)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trend() {
  const month = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);

  const { labels, income, expense } = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => changeMonth(month, i - 5));
    const sums = months.map((m) => getMonthSummary({ transactions, creditTransactions, extraExpenses }, m));
    return {
      labels: months.map((m) => { const t = formatMonthShort(m).split(" ")[0]; return t.charAt(0).toUpperCase() + t.slice(1); }),
      income: sums.map((s) => s.totalIncome),
      expense: sums.map((s) => s.totalExpense),
    };
  }, [month, transactions, creditTransactions, extraExpenses]);

  return (
    <Panel tour="tendencia" title="Últimos 6 meses" subtitle="Renda e despesas">
      <ChartLine
        labels={labels}
        series={[
          { name: "Renda", color: "hsl(var(--inc))", values: income },
          { name: "Despesas", color: "hsl(var(--exp))", values: expense },
        ]}
      />
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Renda</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Despesas</span>
      </div>
    </Panel>
  );
}

function Categories() {
  const month = useFinanceStore((s) => s.currentMonth);
  const totals = useCategoryTotals();
  const colorOf = useCategoryColor();

  return (
    <Panel tour="categorias" title="Despesas por categoria" subtitle={getMonthName(month).replace(/^./, (c) => c.toUpperCase())}>
      {totals.length === 0 ? (
        <Empty>Nenhuma despesa neste mês.</Empty>
      ) : (
        <ChartDonut slices={totals.map((t) => ({ label: t.category.replace("/Parcelado", ""), value: t.value, color: colorOf(t.category) }))} />
      )}
    </Panel>
  );
}

function Suggestion() {
  const { balance } = useMonthSummary();
  const items = useDistributionItems();
  const setDistribution = useFinanceStore((s) => s.setDistribution);
  const customized = useFinanceStore((s) => s.distribution) !== null;
  const parts = useMemo(() => distributeBalance(balance, items), [balance, items]);
  const [editing, setEditing] = useState(false);

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Opções da sugestão" className="grid h-10 w-10 place-items-center sm:h-8 sm:w-8 rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary">
          <Icon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Icon name="edit" size={15} />
          Personalizar percentuais
        </DropdownMenuItem>
        {customized && (
          <DropdownMenuItem onSelect={() => setDistribution(null)}>
            <Icon name="restore" size={15} />
            Restaurar padrão
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {balance <= 0 ? (
        <Panel tour="sugestao" title="Sugestão do saldo" action={menu}>
          <div className="rounded-md bg-bad-bg px-3 py-2.5 text-[13px] font-semibold text-destructive">
            {balance === 0 ? "Seu saldo está zerado. Não há o que distribuir." : "Seu saldo está negativo. Revise despesas variáveis antes de investir."}
          </div>
        </Panel>
      ) : (
        <Panel tour="sugestao" title="Sugestão para o saldo" subtitle={`Como dividir ${formatBRLShort(balance)}`} action={menu}>
          <div className="mb-3.5 flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            {parts.filter((p) => p.item.percent > 0).map((p) => (
              <i key={p.item.id} className="block min-w-1" style={{ flex: p.item.percent, background: sliceColor(items, p.item.id) }} title={`${p.item.label}: ${formatBRL(p.value)}`} />
            ))}
          </div>
          {parts.map((p) => (
            <div key={p.item.id} className="flex items-center gap-2.5 border-t border-border py-2 text-[13.5px] first:border-t-0">
              <i className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: sliceColor(items, p.item.id) }} />
              <span className="min-w-0 break-words">{p.item.label}</span> <small className="text-muted-foreground">{p.item.percent}%</small>
              <b className="num ml-auto">{formatBRL(p.value)}</b>
            </div>
          ))}
        </Panel>
      )}
      <DistributionDialog open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

function GoalsMini() {
  const realGoals = useFinanceStore((s) => s.goals);
  const openLaunch = useUiStore((s) => s.openLaunch);
  // durante o tour, quem não criou metas vê metas de exemplo (o tour não depende de dados do usuário)
  const demo = useUiStore((s) => s.tourDemo) && realGoals.length === 0;
  const goals = useMemo(() => (demo ? getDemoGoals() : realGoals), [demo, realGoals]);

  return (
    <Panel tour="metas" title="Metas" subtitle={demo ? "Exemplo ilustrativo" : "Progresso geral"}>
      {goals.length === 0 ? (
        <Empty>Você ainda não criou metas.</Empty>
      ) : (
        goals.slice(0, 4).map((g) => {
          const pct = goalPercent(g);
          return (
            <div key={g.id} className="mb-3">
              <div className="mb-1.5 flex justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate font-semibold">{g.name}</span>
                <b className="num">{pct}%</b>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-secondary">
                <i className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })
      )}
      {goals.length === 0 ? (
        <button type="button" onClick={() => openLaunch("goal")} className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Criar uma meta →</button>
      ) : (
        <Link to="/metas" className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ver todas as metas →</Link>
      )}
    </Panel>
  );
}

function RecentExpenses() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();
  const month = useFinanceStore((s) => s.currentMonth);
  const extras = useFinanceStore((s) => s.extraExpenses).filter((e) => e.month === month);

  const lines: ExpenseLine[] = [
    ...[...expenses].reverse().map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, fixed: e.fixed })),
    ...credit.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      amount: c.installmentValue,
      installment: `${c.currentInstallment}/${c.installments}`,
      advanced: !!c.advanced,
      progress: { value: c.currentInstallment, max: c.installments },
    })),
    ...extras.map((e) => ({ id: e.id, name: e.name, category: "Outros", amount: e.amount })),
  ];

  return (
    <Panel tour="despesas" title="Despesas do mês" subtitle={`${lines.length} ${lines.length === 1 ? "lançamento" : "lançamentos"} · 5 mais recentes`}>
      {lines.length === 0 ? <Empty>Nenhuma despesa neste mês.</Empty> : lines.slice(0, 5).map((l) => <ExpenseStaticRow key={l.id} line={l} />)}
      <Link to="/lancamentos" className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ver todos os lançamentos →</Link>
    </Panel>
  );
}

function NotesReadOnly() {
  const month = useFinanceStore((s) => s.currentMonth);
  const notes = useFinanceStore((s) => s.notes).filter((n) => n.month === month);
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <Panel tour="anotacoes" title="Anotações" subtitle="Lembretes do mês">
      {sorted.length === 0 ? (
        <Empty>Nenhuma anotação neste mês.</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.slice(0, 4).map((n) => (
            <div key={n.id} className={`flex flex-col gap-1 rounded-md border bg-secondary px-3.5 py-3 text-[13.5px] ${n.pinned ? "border-primary" : "border-border"}`}>
              {n.content}
              <small className="text-xs text-muted-foreground">{n.pinned ? "Fixada · " : ""}{n.date}</small>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function GoalDeadlines() {
  const { unseen: alerts, markSeen } = useGoalAlerts();
  if (alerts.length === 0) return null;
  const urgent = alerts.some((a) => a.level !== "soon");

  return (
    <section role="alert" data-tour="prazos" className={`mb-3.5 rounded-lg border px-5 py-4 ${urgent ? "border-destructive/50 bg-bad-bg" : "border-[hsl(var(--k3)/0.5)] bg-[hsl(var(--k3)/0.12)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <Icon name="bell" size={16} />
          {alerts.length === 1 ? "Uma meta com prazo chegando" : `${alerts.length} metas com prazo chegando`}
        </h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => markSeen(alerts)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline">
            <Icon name="check" size={14} />
            Marcar como visto
          </button>
          <Link to="/metas" className="text-[13px] font-bold text-primary">Ver metas →</Link>
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink2">
        {alerts.slice(0, 3).map((a) => (
          <li key={a.goal.id}>
            <b className="text-foreground">{a.goal.name}</b> · {deadlineStatus(a).toLowerCase()}. {paceHint(a)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Painel somente leitura: tudo o que se edita fica em Lançamentos. */
export default function Painel() {
  const month = useFinanceStore((s) => s.currentMonth);

  return (
    <>
      <PageHeader tour={PAINEL_TOUR} title="Painel" subtitle={`${formatMonthTitle(month)}. Aqui só leitura; cadastre pelo botão “Lançar”.`} />
      <GoalDeadlines />
      <div className="grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12 lg:col-span-4"><Hero /></div>
        <div className="col-span-12 lg:col-span-8"><Trend /></div>
        <div className="col-span-12 lg:col-span-4"><Categories /></div>
        <div className="col-span-12 lg:col-span-4"><Suggestion /></div>
        <div className="col-span-12 lg:col-span-4"><GoalsMini /></div>
        <div className="col-span-12 lg:col-span-8"><RecentExpenses /></div>
        <div className="col-span-12 lg:col-span-4"><NotesReadOnly /></div>
      </div>
    </>
  );
}
