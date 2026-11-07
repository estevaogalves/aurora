import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";
import { LuTarget, LuWallet } from "react-icons/lu";
import StatCard from "@/components/shared/StatCard";
import { getMonthSummary } from "@/domain";
import { formatBRL, formatBRLShort, toReais } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import {
  useCategoryTotals,
  useMonthCredit,
  useMonthSummary,
  useMonthTransactions,
} from "@/Store/selectors";
import { categoryColors } from "@/Utils/categoryColors";
import { changeMonth, formatMonth, formatMonthShort } from "@/Utils/Date";
import MoneyCard from "../Observations/MoneyCard";

function Block({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Trend() {
  const month = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);

  // saldo dos últimos 6 meses terminando no mês visto
  const data = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => changeMonth(month, i - 5)).map((m) => {
        const s = getMonthSummary({ transactions, creditTransactions }, m);
        return { label: formatMonthShort(m), saldo: toReais(s.balance), cents: s.balance };
      }),
    [month, transactions, creditTransactions],
  );

  if (data.every((d) => d.cents === 0)) return <Empty>Sem movimentação nos últimos 6 meses.</Empty>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v: number) => formatBRLShort(Math.round(v * 100))} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))" }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }}
            formatter={(_v, _n, item) => [formatBRL(item.payload.cents), "Saldo"]}
          />
          <Area type="monotone" dataKey="saldo" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#trend)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Categories() {
  const totals = useCategoryTotals();
  const max = Math.max(...totals.map((t) => t.value), 1);

  if (totals.length === 0) return <Empty>Nenhuma despesa neste mês.</Empty>;

  return (
    <ul className="space-y-3">
      {totals.slice(0, 6).map(({ category, value }) => (
        <li key={category}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{category}</span>
            <span className="shrink-0 font-medium text-foreground">{formatBRL(value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: categoryColors[category] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentExpenses() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();

  // mais recentes primeiro (ordem de cadastro); parcelas do crédito entram no fim
  const rows = [
    ...[...expenses].reverse().map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, extra: e.fixed ? "Fixa" : "" })),
    ...credit.map((c) => ({ id: c.id, name: c.name, category: c.category, amount: c.installmentValue, extra: `${c.currentInstallment}/${c.installments}` })),
  ].slice(0, 5);

  if (rows.length === 0) return <Empty>Nenhuma despesa neste mês.</Empty>;

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[r.category] }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.category}{r.extra && ` · ${r.extra}`}</p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-foreground">{formatBRL(r.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Painel somente leitura: tudo o que se edita fica em Lançamentos. */
export default function Painel() {
  const month = useFinanceStore((s) => s.currentMonth);
  const { totalIncome, totalExpense, balance, expensePercentage } = useMonthSummary();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground">Painel</h1>
        <p className="capitalize text-muted-foreground">{formatMonth(month)}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Renda total" value={formatBRL(totalIncome)} hint="Soma de todas as fontes" icon={<LuWallet />} tone="primary" />
        <StatCard label="Despesas" value={formatBRL(totalExpense)} hint={`${expensePercentage.toFixed(1).replace(".", ",")}% da renda`} icon={<FaArrowTrendDown />} tone="danger" />
        <StatCard label="Saldo" value={formatBRL(balance)} hint={balance < 0 ? "Gastou mais do que ganhou" : "Disponível para uso"} icon={<FaArrowTrendUp />} tone={balance < 0 ? "danger" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Block title="Tendência" subtitle="Saldo dos últimos 6 meses" className="lg:col-span-2">
          <Trend />
        </Block>
        <Block title="Gastos por categoria">
          <Categories />
        </Block>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <MoneyCard />
        </div>
        <Block title="Últimas despesas" subtitle="5 mais recentes do mês" className="lg:col-span-1">
          <RecentExpenses />
        </Block>
        <Block title="Metas" subtitle="Seus objetivos financeiros" className="lg:col-span-1">
          <div className="flex flex-col items-start gap-3 py-2">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-xl text-accent"><LuTarget /></span>
            <p className="text-sm text-muted-foreground">O acompanhamento de metas no painel chega junto da tela de Metas.</p>
            <Link to="/metas" className="text-sm font-medium text-primary hover:underline">Ir para Metas</Link>
          </div>
        </Block>
      </div>
    </div>
  );
}
