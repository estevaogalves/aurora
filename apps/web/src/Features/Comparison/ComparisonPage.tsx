import { useMemo, useState } from "react";
import ChartGroupBars from "@/components/charts/ChartGroupBars";
import ChartRadar from "@/components/charts/ChartRadar";
import Panel, { Empty, PageHeader } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { getAvailableMonths, getMonthSummary } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import type { Category } from "@/Types/Category";
import { categoryColors } from "@/Utils/categoryColors";
import { compareMonths, formatMonth, formatMonthShort, getCurrentMonth, getMonthName } from "@/Utils/Date";

const MAX_SELECTED = 3;
const MAX_MONTHS = 12;
const SERIES_COLORS = ["hsl(var(--s1))", "hsl(var(--s2))", "hsl(var(--s3))"];

const CATEGORIES: Category[] = ["Moradia", "Transporte", "Alimentação", "Saúde", "Educação", "Lazer", "Serviços", "Outros", "Crédito/Parcelado"];
const RADAR_AXES: Category[] = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Crédito/Parcelado"];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const shortLabel = (m: string) => cap(formatMonthShort(m).split(" ")[0]);
const chipLabel = (m: string) => `${shortLabel(m)}/${m.slice(2, 4)}`;

export default function ComparisonPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const notes = useFinanceStore((s) => s.notes);
  const current = useFinanceStore((s) => s.currentMonth);

  const available = useMemo(() => {
    // só meses que já aconteceram: o futuro é assunto da Projeção
    const today = getCurrentMonth();
    const months = getAvailableMonths({ transactions, creditTransactions, notes }, today).filter((m) => compareMonths(m, today) <= 0);
    const all = months.length ? months : [current];
    return all.slice(-MAX_MONTHS);
  }, [transactions, creditTransactions, notes, current]);

  const [picked, setPicked] = useState<string[] | null>(null);
  // sem escolha do usuário: os 3 últimos meses; escolhas de meses que sumiram são ignoradas
  const selected = useMemo(() => {
    const valid = (picked ?? available.slice(-MAX_SELECTED)).filter((m) => available.includes(m));
    return valid.sort(compareMonths);
  }, [picked, available]);

  const data = useMemo(() => ({ transactions, creditTransactions }), [transactions, creditTransactions]);
  const summaries = useMemo(() => available.map((m) => getMonthSummary(data, m)), [available, data]);
  const bySelected = summaries.filter((s) => selected.includes(s.month));

  function toggle(month: string) {
    const base = picked ?? selected;
    if (base.includes(month)) setPicked(base.filter((m) => m !== month));
    else setPicked([...base, month].slice(-MAX_SELECTED));
  }

  const avg = bySelected.length ? Math.round(bySelected.reduce((s, m) => s + m.balance, 0) / bySelected.length) : 0;
  const best = bySelected.reduce((a, b) => (b.balance > a.balance ? b : a), bySelected[0]);
  const worst = bySelected.reduce((a, b) => (b.balance < a.balance ? b : a), bySelected[0]);

  const ranking = [...summaries].sort((a, b) => b.balance - a.balance);
  const rankMax = Math.max(...ranking.map((m) => Math.abs(m.balance)), 1);
  const catMax = Math.max(...bySelected.flatMap((m) => CATEGORIES.map((c) => m.byCategory[c] ?? 0)), 1);

  return (
    <>
      <PageHeader title="Comparação" subtitle="Escolha os meses e veja a diferença." />

      <Panel title="Meses" subtitle={`Até ${MAX_SELECTED} ao mesmo tempo`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Meses comparados">
          {available.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={selected.includes(m)}
              onClick={() => toggle(m)}
              className="rounded-full border border-border-strong bg-card px-3.5 py-[7px] text-[13px] font-semibold text-ink2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-[0_6px_18px_color-mix(in_srgb,hsl(var(--primary))_35%,transparent)]"
            >
              {chipLabel(m)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">Escolha até {MAX_SELECTED} meses.</p>
      </Panel>

      {bySelected.length === 0 ? (
        <div className="mt-3.5"><Panel title="Nenhum mês escolhido"><Empty>Selecione ao menos um mês para comparar.</Empty></Panel></div>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
            <StatCard label="Saldo médio" value={formatBRL(avg)} hint={`${bySelected.length} ${bySelected.length === 1 ? "mês" : "meses"}`} />
            <StatCard label="Melhor mês" value={cap(getMonthName(best.month))} tone="good" hint={formatBRL(best.balance)} />
            <StatCard label="Pior mês" value={cap(getMonthName(worst.month))} hint={formatBRL(worst.balance)} />
          </div>

          <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
            <div className="col-span-12 lg:col-span-4">
              <Panel title="Ranking de saldo" subtitle="Do melhor ao pior mês">
                <div className="flex flex-col gap-2.5">
                  {ranking.map((m, i) => (
                    <div key={m.month} className="grid grid-cols-[28px_54px_1fr_auto] items-center gap-2.5 text-[13.5px]">
                      <span className="font-extrabold text-muted-foreground">{i + 1}º</span>
                      <span>{chipLabel(m.month)}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                        <i className={`block h-full rounded-full ${m.balance < 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${(Math.abs(m.balance) / rankMax) * 100}%` }} />
                      </div>
                      <b className="num">{formatBRLShort(m.balance)}</b>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="col-span-12 lg:col-span-8">
              <Panel title="Renda e despesa" subtitle="Meses selecionados">
                <ChartGroupBars
                  labels={bySelected.map((m) => shortLabel(m.month))}
                  series={[
                    { name: "Renda", color: "hsl(var(--inc))", values: bySelected.map((m) => m.totalIncome) },
                    { name: "Despesas", color: "hsl(var(--exp))", values: bySelected.map((m) => m.totalExpense) },
                  ]}
                />
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Renda</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Despesas</span>
                </div>
              </Panel>
            </div>

            <div className="col-span-12 lg:col-span-6">
              <Panel title="Perfil de gastos" subtitle="Onde cada mês pesou mais">
                <ChartRadar
                  axes={RADAR_AXES.map((c) => c.replace("/Parcelado", "").replace("Crédito", "Crédito"))}
                  series={bySelected.map((m, i) => ({ name: formatMonth(m.month), color: SERIES_COLORS[i], values: RADAR_AXES.map((c) => m.byCategory[c] ?? 0) }))}
                />
                <Legend months={bySelected.map((m) => m.month)} />
              </Panel>
            </div>
            <div className="col-span-12 lg:col-span-6">
              <Panel title="Categorias lado a lado" subtitle="Valor gasto em cada uma">
                <div className="flex flex-col gap-3">
                  {CATEGORIES.map((c) => (
                    <div key={c} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 flex-none rounded-[2px]" style={{ background: categoryColors[c] }} />{c.replace("/Parcelado", "")}</span>
                      <div className="flex flex-col gap-[3px]">
                        {bySelected.map((m, j) => {
                          const v = m.byCategory[c] ?? 0;
                          return <i key={m.month} title={`${formatMonth(m.month)} · ${c}: ${formatBRL(v)}`} className="block h-[7px] min-w-[2px] rounded-r" style={{ width: `${(v / catMax) * 100}%`, background: SERIES_COLORS[j] }} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Legend months={bySelected.map((m) => m.month)} className="mt-3.5" />
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Legend({ months, className = "mt-1.5" }: { months: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2 ${className}`}>
      {months.map((m, i) => (
        <span key={m} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} />{getMonthName(m)}</span>
      ))}
    </div>
  );
}
