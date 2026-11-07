import { useMemo } from "react";
import { Link } from "react-router-dom";
import ChartDonut from "@/components/charts/ChartDonut";
import ChartLine from "@/components/charts/ChartLine";
import Panel, { Empty, PageHeader } from "@/components/shared/Panel";
import { DISTRIBUTION, getDistribution, getMonthSummary } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useCategoryTotals, useMonthCredit, useMonthSummary, useMonthTransactions } from "@/Store/selectors";
import { categoryColors } from "@/Utils/categoryColors";
import { changeMonth, formatMonthShort, formatMonthTitle, getMonthName } from "@/Utils/Date";
import { ExpenseStaticRow, type ExpenseLine } from "../Launch/rows";

const DIST_COLORS = ["--k1", "--k2", "--k3", "--k4", "--k5"];

function Hero() {
  const month = useFinanceStore((s) => s.currentMonth);
  const { totalIncome, totalExpense, balance, expensePercentage } = useMonthSummary();
  const pct = Math.round(expensePercentage);

  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-border-strong bg-[linear-gradient(155deg,color-mix(in_srgb,hsl(var(--primary))_38%,hsl(var(--card))),hsl(var(--card))_70%)] p-6 shadow-[var(--shadow-card)]">
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

  const { labels, income, expense } = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => changeMonth(month, i - 5));
    const sums = months.map((m) => getMonthSummary({ transactions, creditTransactions }, m));
    return {
      labels: months.map((m) => { const t = formatMonthShort(m).split(" ")[0]; return t.charAt(0).toUpperCase() + t.slice(1); }),
      income: sums.map((s) => s.totalIncome),
      expense: sums.map((s) => s.totalExpense),
    };
  }, [month, transactions, creditTransactions]);

  return (
    <Panel title="Últimos 6 meses" subtitle="Renda e despesas">
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

  return (
    <Panel title="Despesas por categoria" subtitle={getMonthName(month).replace(/^./, (c) => c.toUpperCase())}>
      {totals.length === 0 ? (
        <Empty>Nenhuma despesa neste mês.</Empty>
      ) : (
        <ChartDonut slices={totals.map((t) => ({ label: t.category.replace("/Parcelado", ""), value: t.value, color: categoryColors[t.category] }))} />
      )}
    </Panel>
  );
}

function Suggestion() {
  const { balance } = useMonthSummary();
  const dist = useMemo(() => getDistribution(balance), [balance]);

  if (balance <= 0) {
    return (
      <Panel title="Sugestão do saldo">
        <div className="rounded-md bg-bad-bg px-3 py-2.5 text-[13px] font-semibold text-destructive">
          {balance === 0 ? "Seu saldo está zerado. Não há o que distribuir." : "Seu saldo está negativo. Revise despesas variáveis antes de investir."}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Sugestão para o saldo" subtitle={`Como dividir ${formatBRLShort(balance)}`}>
      <div className="mb-3.5 flex h-3.5 gap-0.5 overflow-hidden rounded-full">
        {DISTRIBUTION.map((d, i) => (
          <i key={d.key} className="block min-w-1" style={{ flex: d.percent, background: `hsl(var(${DIST_COLORS[i]}))` }} title={`${d.label}: ${formatBRL(dist[d.key])}`} />
        ))}
      </div>
      {DISTRIBUTION.map((d, i) => (
        <div key={d.key} className="flex items-center gap-2.5 border-t border-border py-2 text-[13.5px] first:border-t-0">
          <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `hsl(var(${DIST_COLORS[i]}))` }} />
          {d.label} <small className="text-muted-foreground">{d.percent}%</small>
          <b className="num ml-auto">{formatBRL(dist[d.key])}</b>
        </div>
      ))}
    </Panel>
  );
}

function GoalsMini() {
  return (
    <Panel title="Metas" subtitle="Progresso geral">
      <Empty>Você ainda não criou metas.</Empty>
      <Link to="/metas" className="mt-3 inline-block text-[13px] font-bold text-primary">Ir para Metas →</Link>
    </Panel>
  );
}

function RecentExpenses() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();

  const lines: ExpenseLine[] = [
    ...[...expenses].reverse().map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, fixed: e.fixed })),
    ...credit.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      amount: c.installmentValue,
      installment: `${c.currentInstallment}/${c.installments}`,
      progress: { value: c.currentInstallment, max: c.installments },
    })),
  ];

  return (
    <Panel title="Despesas do mês" subtitle={`${lines.length} ${lines.length === 1 ? "lançamento" : "lançamentos"} · 5 mais recentes`}>
      {lines.length === 0 ? <Empty>Nenhuma despesa neste mês.</Empty> : lines.slice(0, 5).map((l) => <ExpenseStaticRow key={l.id} line={l} />)}
      <Link to="/lancamentos" className="mt-3 inline-block text-[13px] font-bold text-primary">Ver todos os lançamentos →</Link>
    </Panel>
  );
}

function NotesReadOnly() {
  const month = useFinanceStore((s) => s.currentMonth);
  const notes = useFinanceStore((s) => s.notes).filter((n) => n.month === month);
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <Panel title="Anotações" subtitle="Lembretes do mês">
      {sorted.length === 0 ? (
        <Empty>Nenhuma anotação neste mês.</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.slice(0, 4).map((n) => (
            <div key={n.id} className="flex flex-col gap-1 rounded-md border border-border bg-secondary px-3.5 py-3 text-[13.5px]">
              {n.content}
              <small className="text-xs text-muted-foreground">{n.pinned ? "Fixada · " : ""}{n.date}</small>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Painel somente leitura: tudo o que se edita fica em Lançamentos. */
export default function Painel() {
  const month = useFinanceStore((s) => s.currentMonth);

  return (
    <>
      <PageHeader title="Painel" subtitle={`${formatMonthTitle(month)}. Aqui só leitura; cadastre pelo botão “Lançar”.`} />
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
