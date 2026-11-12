import { useMemo, useState } from "react";
import ChartGroupBars from "@/components/charts/ChartGroupBars";
import ChartLine from "@/components/charts/ChartLine";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import RowMenu from "@/components/shared/RowMenu";
import StatCard from "@/components/shared/StatCard";
import { SCENARIOS, basisLabel, estimateVariableIncome, getCreditByMonth, getCreditProgress, getProjection, getProjectionDetail, type ProjectionLine } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { usePrefsStore } from "@/lib/preferences";
import { useFinanceStore, type ExtraExpense } from "@/Store/FinanceStore";
import { useResolvedCredits } from "@/Store/selectors";
import { useCategoryColor } from "@/Utils/categoryColors";
import { changeMonth, formatMonthShort, formatMonthTitle, getCurrentMonth } from "@/Utils/Date";
import EditExtraDialog from "./EditExtraDialog";
import { PROJECAO_TOUR } from "./tour";

const DEFAULT_MONTHS = 6;
const MIN_MONTHS = 2;
const MAX_MONTHS = 12;

const arrow =
  "grid h-10 w-10 place-items-center sm:h-9 sm:w-9 rounded-md border border-border-strong bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const shortLabel = (month: string) => cap(formatMonthShort(month).split(" ")[0]);

/** Linhas de renda ou despesa de um mês, com o total embaixo. */
function DetailList({ title, lines, empty }: { title: string; lines: ProjectionLine[]; empty: string }) {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{title}</p>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lines.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words">{l.name}{l.kind === "extra" && <span className="text-muted-foreground"> · extra</span>}</span>
              <span className="num flex-none font-semibold">{formatBRL(l.amount)}</span>
            </li>
          ))}
          <li className="mt-0.5 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-bold">
            <span>Total</span>
            <span className="num">{formatBRL(total)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}

export default function ProjectionPage() {
  const current = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const resolvedCredits = useResolvedCredits();
  const extras = useFinanceStore((s) => s.extraExpenses);
  const removeExtra = useFinanceStore((s) => s.removeExtraExpense);
  const colorOf = useCategoryColor();
  const [editing, setEditing] = useState<ExtraExpense | null>(null);
  const [deleting, setDeleting] = useState<ExtraExpense | null>(null);
  const [count, setCount] = useState(DEFAULT_MONTHS);
  const scenario = usePrefsStore((s) => s.scenario);

  // do mês seguinte ao que está sendo visto
  const start = changeMonth(current, 1);
  // cenário: estima a renda variável dos meses futuros (nunca de mês passado). Conservador = só renda fixa, como antes.
  const today = getCurrentMonth();
  const variable = useMemo(
    () => estimateVariableIncome({ transactions, creditTransactions, creditCards }, scenario, today),
    [transactions, creditTransactions, creditCards, scenario, today],
  );
  const estimate = useMemo(() => ({ perMonth: variable.perMonth, after: today }), [variable.perMonth, today]);
  const projection = useMemo(
    () => getProjection({ transactions, creditTransactions, creditCards }, extras, start, count, estimate),
    [transactions, creditTransactions, creditCards, extras, start, count, estimate],
  );
  const months = projection.map((p) => p.month);
  const labels = months.map(shortLabel);

  const first = projection[0];
  const worst = projection.reduce((a, b) => (b.balance < a.balance ? b : a), first);
  const total = projection[projection.length - 1].accumulated;
  const creditTotal = projection.reduce((s, p) => s + p.creditExpense, 0);
  const fixedMonthly = first.expense - first.creditExpense - first.extraExpense;

  const detailOf = (index: number) => {
    const month = months[index];
    const { incomes, expenses } = getProjectionDetail({ transactions, creditTransactions, creditCards }, extras, month, estimate);
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-[14px] font-semibold">{cap(formatMonthTitle(month))}</p>
        <DetailList title="Rendas" lines={incomes} empty="Nenhuma renda fixa." />
        <DetailList title="Despesas" lines={expenses} empty="Nenhuma despesa prevista." />
      </div>
    );
  };

  const extrasInWindow = extras.filter((e) => months.includes(e.month)).sort((a, b) => a.month.localeCompare(b.month));
  // compras que ainda cobram parcela em algum mês da janela
  const activeCredits = resolvedCredits.filter((c) => months.some((m) => getCreditByMonth([c], m).some((i) => !i.advanced)));

  return (
    <>
      <PageHeader
        tour={PROJECAO_TOUR}
        title="Projeção futura"
        subtitle={`Os próximos ${count} meses com o que já está previsto.`}
        action={
          <div data-tour="periodo" role="group" aria-label="Quantidade de meses da projeção" className="flex items-center gap-1.5">
            <button type="button" aria-label="Diminuir um mês" disabled={count <= MIN_MONTHS} onClick={() => setCount((c) => Math.max(MIN_MONTHS, c - 1))} className={arrow}>
              <Icon name="chevronL" size={16} />
            </button>
            <span className="num min-w-[4.5rem] text-center text-[13px] font-semibold" aria-live="polite">{count} meses</span>
            <button type="button" aria-label="Aumentar um mês" disabled={count >= MAX_MONTHS} onClick={() => setCount((c) => Math.min(MAX_MONTHS, c + 1))} className={arrow}>
              <Icon name="chevronR" size={16} />
            </button>
            {count !== DEFAULT_MONTHS && (
              <button type="button" onClick={() => setCount(DEFAULT_MONTHS)} className="ml-1 text-[12.5px] font-semibold text-primary hover:underline">
                Voltar ao padrão ({DEFAULT_MONTHS} meses)
              </button>
            )}
          </div>
        }
      />

      <section data-tour="cenario" aria-label="Cenário da renda variável" className="mb-3.5 rounded-lg border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold">Cenário da renda variável</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">A Projeção só conta renda fixa. Escolha como estimar a renda variável (13º, bônus, freelas) dos meses futuros.</p>
          </div>
          <div role="radiogroup" aria-label="Cenário" className="inline-flex rounded-full border border-border bg-background p-1">
            {SCENARIOS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={scenario === s.value}
                title={s.hint}
                onClick={() => usePrefsStore.getState().setPrefs({ scenario: s.value })}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-sm:min-h-10 ${scenario === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-ink2">
          {scenario === "conservative" && "Só renda fixa: nada é estimado."}
          {scenario !== "conservative" && variable.noHistory && "Ainda não há meses com movimento para estimar a renda variável; nada foi acrescentado."}
          {scenario !== "conservative" && !variable.noHistory && variable.perMonth === 0 && `Nos meses de ${basisLabel(variable.basis)} você não teve renda variável; nada foi acrescentado.`}
          {scenario !== "conservative" && variable.perMonth > 0 && (
            <>
              Renda variável estimada {scenario === "average" ? "pela média" : "pelo maior valor"} de {basisLabel(variable.basis)}: <b className="num text-foreground">{formatBRL(variable.perMonth)}</b> por mês, só nos meses depois de {formatMonthTitle(today)}.
              {variable.basis.length < 3 && " (Histórico curto: usei o que havia.)"}
            </>
          )}
        </p>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard tour="fixa" label="Despesa fixa mensal" value={formatBRL(fixedMonthly)} hint="Despesas marcadas como fixas" />
        <StatCard tour="parcelas-total" label={`Parcelas até ${shortLabel(months[months.length - 1]).toLowerCase()}`} value={formatBRL(creditTotal)} hint="Compras no crédito em curso" />
        <StatCard tour="pior" label="Pior mês" value={shortLabel(worst.month)} tone={worst.balance < 0 ? "bad" : "default"} hint={`Saldo de ${formatBRL(worst.balance)}`} />
        <StatCard tour="saldo-total" label={`Saldo em ${count} meses`} value={formatBRL(total)} hint={`${shortLabel(months[0])} a ${shortLabel(months[months.length - 1])}`} highlight />
      </div>

      <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12">
          <Panel tour="renda-despesa" title="Renda × despesa projetadas" subtitle={`Próximos ${count} meses. Clique em um mês para ver o detalhe.`}>
            <ChartGroupBars
              labels={labels}
              renderDetail={detailOf}
              series={[
                { name: "Renda prevista", color: "hsl(var(--inc))", values: projection.map((p) => p.income) },
                { name: "Despesa prevista", color: "hsl(var(--exp))", values: projection.map((p) => p.expense) },
              ]}
            />
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Renda prevista</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Despesa prevista</span>
            </div>
            <p className="mt-3 text-[12.5px] text-muted-foreground">Só entram rendas e despesas marcadas como fixas, parcelas do crédito e despesas extras{scenario !== "conservative" && variable.perMonth > 0 ? ", mais a renda variável estimada do cenário escolhido" : ""}.</p>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel tour="acumulado" title="Saldo acumulado" subtitle="Quanto sobra somando os meses">
            <ChartLine tapDetail labels={labels} series={[{ name: "Saldo acumulado", color: "hsl(var(--primary))", area: true, values: projection.map((p) => p.accumulated) }]} height={230} />
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel tour="extras" title="Despesas extras planejadas" subtitle="Gastos que não se repetem todo mês. Cadastre pelo botão Lançar.">
            {extrasInWindow.length === 0 ? (
              <Empty>Nenhuma despesa extra nos próximos meses. Use Lançar → Despesa extra.</Empty>
            ) : (
              extrasInWindow.map((e) => (
                <div key={e.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
                  <Pill>{shortLabel(e.month)}</Pill>
                  <span className="min-w-0 break-words font-semibold">{e.name}</span>
                  <span className="num font-bold">{formatBRL(e.amount)}</span>
                  <RowMenu label={e.name} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
                </div>
              ))
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel tour="creditos" title="Parcelas no crédito" subtitle="O que ainda vai cair">
            {activeCredits.length === 0 ? (
              <Empty>Nenhuma compra parcelada em curso.</Empty>
            ) : (
              activeCredits.map((c) => {
                if (c.recurring) {
                  return (
                    <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colorOf(c.category) }} />
                      <div className="min-w-0">
                        <div className="break-words font-semibold">{c.name}</div>
                        <div className="mt-0.5 text-[12.5px] text-muted-foreground">Recorrente{c.variableAmount ? " · valor estimado" : ""} · {c.endMonth ? `cobra até ${shortLabel(c.endMonth)}` : "todo mês"}</div>
                      </div>
                      <span className="num font-bold">{formatBRLShort(c.totalAmount)}</span>
                    </div>
                  );
                }
                const { done, remaining, endMonth: end } = getCreditProgress(c, current);
                return (
                  <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colorOf(c.category) }} />
                    <div className="min-w-0">
                      <div className="break-words font-semibold">{c.name}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted-foreground">Faltam {remaining} {remaining === 1 ? "parcela" : "parcelas"} · termina em {shortLabel(end)}</div>
                      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-primary" style={{ width: `${(done / c.installments) * 100}%` }} /></div>
                    </div>
                    <span className="num font-bold">{formatBRLShort(Math.round(c.totalAmount / c.installments))}</span>
                  </div>
                );
              })
            )}
          </Panel>
        </div>
      </div>

      <EditExtraDialog extra={editing} onClose={() => setEditing(null)} />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `despesa extra "${deleting.name}" (${formatBRL(deleting.amount)})` : "despesa extra"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeExtra(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
