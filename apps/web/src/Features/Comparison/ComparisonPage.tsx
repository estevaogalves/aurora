import { useMemo, useState } from "react";
import ChartGroupBars from "@/components/charts/ChartGroupBars";
import ChartRadar from "@/components/charts/ChartRadar";
import Panel, { Empty, PageHeader } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { getAvailableMonths, getMonthSummary } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { EXPENSE_CATEGORIES, type Category } from "@/Types/Category";
import { useCategoryColor } from "@/Utils/categoryColors";
import { compareMonths, formatMonth, formatMonthShort, getCurrentMonth, getMonthName } from "@/Utils/Date";
import { getDemoSummaries } from "./demo";
import { COMPARACAO_TOUR } from "./tour";

const MAX_SELECTED = 5;
const MAX_MONTHS = 12;
const SERIES_COLORS = ["hsl(var(--s1))", "hsl(var(--s2))", "hsl(var(--s3))", "hsl(var(--s4))", "hsl(var(--s5))"];

const BASE_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES];
const RADAR_AXES: Category[] = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer"];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const shortLabel = (m: string) => cap(formatMonthShort(m).split(" ")[0]);
const chipLabel = (m: string) => `${shortLabel(m)}/${m.slice(2, 4)}`;

export default function ComparisonPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const notes = useFinanceStore((s) => s.notes);
  const customCategories = useFinanceStore((s) => s.customCategories);
  const colorOf = useCategoryColor();

  const data = useMemo(() => ({ transactions, creditTransactions, creditCards, extraExpenses }), [transactions, creditTransactions, creditCards, extraExpenses]);

  // só meses que já aconteceram e tiveram movimentação (renda ou despesa)
  const real = useMemo(() => {
    const today = getCurrentMonth();
    const months = getAvailableMonths({ transactions, creditTransactions, creditCards, notes }, today).filter((m) => compareMonths(m, today) <= 0);
    return months.map((m) => getMonthSummary(data, m)).filter((s) => s.totalIncome > 0 || s.totalExpense > 0).slice(-MAX_MONTHS);
  }, [transactions, creditTransactions, creditCards, notes, data]);
  // durante o tour, quem ainda não tem 2 meses vê meses de exemplo (o tour não depende de dados do usuário)
  const demo = useUiStore((s) => s.tourDemo) && real.length < 2;
  const summaries = useMemo(() => (demo ? getDemoSummaries() : real), [demo, real]);
  const available = useMemo(() => summaries.map((s) => s.month), [summaries]);

  // sem escolha do usuário: os últimos meses (até o limite); meses que sumiram são ignorados
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = useMemo(
    () => (picked ?? available.slice(-MAX_SELECTED)).filter((m) => available.includes(m)).sort(compareMonths),
    [picked, available],
  );
  const atLimit = selected.length >= MAX_SELECTED;

  // no limite, o mês novo só entra depois que o usuário desmarcar outro (nada some sozinho)
  function toggle(month: string) {
    if (selected.includes(month)) setPicked(selected.filter((m) => m !== month));
    else if (!atLimit) setPicked([...selected, month]);
  }

  const bySelected = summaries.filter((s) => selected.includes(s.month));

  // as da lista mais qualquer outra que tenha gasto nos meses escolhidos (ex.: uma categoria apagada ou o resto antigo do crédito)
  const known = [...BASE_CATEGORIES, ...customCategories.map((c) => c.name)];
  const extra = [...new Set(bySelected.flatMap((m) => Object.entries(m.byCategory).filter(([c, v]) => (v ?? 0) !== 0 && !known.includes(c)).map(([c]) => c)))];
  const CATEGORIES = [...known, ...extra];
  const avg = bySelected.length ? Math.round(bySelected.reduce((s, m) => s + m.balance, 0) / bySelected.length) : 0;
  const best = bySelected.reduce((a, b) => (b.balance > a.balance ? b : a), bySelected[0]);
  const worst = bySelected.reduce((a, b) => (b.balance < a.balance ? b : a), bySelected[0]);

  const ranking = [...summaries].sort((a, b) => b.balance - a.balance);
  const rankMax = Math.max(...ranking.map((m) => Math.abs(m.balance)), 1);
  const catMax = Math.max(...bySelected.flatMap((m) => CATEGORIES.map((c) => m.byCategory[c] ?? 0)), 1);

  return (
    <>
      <PageHeader tour={COMPARACAO_TOUR} title="Comparação" subtitle="Escolha os meses e veja a diferença." />

      {demo && (
        <p role="note" className="mb-3.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <b className="text-foreground">Exemplo ilustrativo.</b> Estes meses são fictícios, só para mostrar a tela. Os seus aparecem aqui quando houver 2 meses com movimentação.
        </p>
      )}

      {available.length >= 2 && (
        <Panel tour="meses" title="Meses" subtitle={`Até ${MAX_SELECTED} ao mesmo tempo`}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Meses comparados">
            {available.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={selected.includes(m)}
                disabled={atLimit && !selected.includes(m)}
                onClick={() => toggle(m)}
                className="rounded-full max-sm:min-h-10 disabled:cursor-not-allowed disabled:opacity-40 border border-border-strong bg-card px-3.5 py-[7px] text-[13px] font-semibold text-ink2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-[0_6px_18px_color-mix(in_srgb,hsl(var(--primary))_35%,transparent)]"
              >
                {chipLabel(m)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {selected.length} de {MAX_SELECTED} selecionados{atLimit ? ". Desmarque um mês para escolher outro." : ""}
          </p>
        </Panel>
      )}

      {available.length < 2 ? (
        <div className="mt-3.5">
          <Panel title="Dados insuficientes" subtitle="A comparação precisa de pelo menos dois meses com movimentações">
            <Empty>
              {available.length === 0
                ? "Ainda não há lançamentos. Use o botão Lançar para cadastrar rendas e despesas."
                : `Só ${formatMonth(available[0])} tem movimentações. Quando outro mês tiver lançamentos, a comparação aparece aqui.`}
            </Empty>
          </Panel>
        </div>
      ) : bySelected.length < 2 ? (
        <div className="mt-3.5">
          <Panel title="Escolha pelo menos 2 meses" subtitle="A comparação exige no mínimo dois meses com movimentações">
            <Empty>{bySelected.length === 0 ? "Nenhum mês selecionado." : `Só ${formatMonth(bySelected[0].month)} está selecionado.`} Marque outro mês acima para ver a comparação.</Empty>
          </Panel>
        </div>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
            <StatCard tour="saldo-medio" label="Saldo médio" value={formatBRL(avg)} hint={`${bySelected.length} ${bySelected.length === 1 ? "mês" : "meses"}`} />
            <StatCard tour="melhor" label="Melhor mês" value={cap(getMonthName(best.month))} tone="good" hint={formatBRL(best.balance)} />
            <StatCard tour="pior" label="Pior mês" value={cap(getMonthName(worst.month))} hint={formatBRL(worst.balance)} />
          </div>

          <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
            <div className="col-span-12 lg:col-span-4">
              <Panel tour="ranking" title="Ranking de saldo" subtitle="Do melhor ao pior mês">
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
              <Panel tour="renda-despesa" title="Renda e despesa" subtitle="Meses selecionados">
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
              <Panel tour="perfil" title="Perfil de gastos" subtitle="Onde cada mês pesou mais">
                <ChartRadar
                  axes={RADAR_AXES}
                  series={bySelected.map((m, i) => ({ name: formatMonth(m.month), color: SERIES_COLORS[i], values: RADAR_AXES.map((c) => m.byCategory[c] ?? 0) }))}
                />
                <Legend months={bySelected.map((m) => m.month)} />
              </Panel>
            </div>
            <div className="col-span-12 lg:col-span-6">
              <Panel tour="categorias" title="Categorias lado a lado" subtitle="Valor gasto em cada uma">
                <div className="flex flex-col gap-3">
                  {CATEGORIES.map((c) => (
                    <div key={c} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 flex-none rounded-[2px]" style={{ background: colorOf(c) }} />{c}</span>
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
