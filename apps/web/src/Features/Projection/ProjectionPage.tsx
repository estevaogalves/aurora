import { useMemo } from "react";
import ChartGroupBars from "@/components/charts/ChartGroupBars";
import ChartLine from "@/components/charts/ChartLine";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { getProjection } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useCategoryColor } from "@/Utils/categoryColors";
import { changeMonth, formatMonthShort, monthsDifference } from "@/Utils/Date";

const MONTHS_AHEAD = 6;

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const shortLabel = (month: string) => cap(formatMonthShort(month).split(" ")[0]);

export default function ProjectionPage() {
  const current = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const extras = useFinanceStore((s) => s.extraExpenses);
  const removeExtra = useFinanceStore((s) => s.removeExtraExpense);
  const colorOf = useCategoryColor();

  // do mês seguinte ao que está sendo visto
  const start = changeMonth(current, 1);
  const projection = useMemo(
    () => getProjection({ transactions, creditTransactions }, extras, start, MONTHS_AHEAD),
    [transactions, creditTransactions, extras, start],
  );
  const months = projection.map((p) => p.month);
  const labels = months.map(shortLabel);

  const first = projection[0];
  const worst = projection.reduce((a, b) => (b.balance < a.balance ? b : a), first);
  const total = projection[projection.length - 1].accumulated;
  const creditTotal = projection.reduce((s, p) => s + p.creditExpense, 0);
  const fixedMonthly = first.expense - first.creditExpense - first.extraExpense;

  const extrasInWindow = extras.filter((e) => months.includes(e.month)).sort((a, b) => a.month.localeCompare(b.month));
  // compras que ainda cobram parcela em algum mês da janela
  const activeCredits = creditTransactions.filter((c) =>
    months.some((m) => {
      const n = monthsDifference(m, c.startMonth);
      return n >= 0 && n < c.installments;
    }),
  );

  return (
    <>
      <PageHeader
        title="Projeção futura"
        subtitle={`Os próximos ${MONTHS_AHEAD} meses com o que já está previsto.`}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard label="Despesa fixa mensal" value={formatBRL(fixedMonthly)} hint="Despesas marcadas como fixas" />
        <StatCard label={`Parcelas até ${shortLabel(months[months.length - 1]).toLowerCase()}`} value={formatBRL(creditTotal)} hint="Compras no crédito em curso" />
        <StatCard label="Pior mês" value={shortLabel(worst.month)} tone={worst.balance < 0 ? "bad" : "default"} hint={`Saldo de ${formatBRL(worst.balance)}`} />
        <StatCard label={`Saldo em ${MONTHS_AHEAD} meses`} value={formatBRL(total)} hint={`${shortLabel(months[0])} a ${shortLabel(months[months.length - 1])}`} highlight />
      </div>

      <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12">
          <Panel title="Renda × despesa projetadas" subtitle={`Próximos ${MONTHS_AHEAD} meses`}>
            <ChartGroupBars
              labels={labels}
              series={[
                { name: "Renda prevista", color: "hsl(var(--inc))", values: projection.map((p) => p.income) },
                { name: "Despesa prevista", color: "hsl(var(--exp))", values: projection.map((p) => p.expense) },
              ]}
            />
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Renda prevista</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Despesa prevista</span>
            </div>
            <p className="mt-3 text-[12.5px] text-muted-foreground">Só entram rendas e despesas marcadas como fixas, parcelas do crédito e despesas extras.</p>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel title="Saldo acumulado" subtitle="Quanto sobra somando os meses">
            <ChartLine labels={labels} series={[{ name: "Saldo acumulado", color: "hsl(var(--primary))", area: true, values: projection.map((p) => p.accumulated) }]} height={230} />
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel title="Despesas extras planejadas" subtitle="Gastos que não se repetem todo mês. Cadastre pelo botão Lançar.">
            {extrasInWindow.length === 0 ? (
              <Empty>Nenhuma despesa extra nos próximos meses. Use Lançar → Despesa extra.</Empty>
            ) : (
              extrasInWindow.map((e) => (
                <div key={e.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
                  <Pill>{shortLabel(e.month)}</Pill>
                  <span className="min-w-0 break-words font-semibold">{e.name}</span>
                  <span className="num font-bold">{formatBRL(e.amount)}</span>
                  <button type="button" aria-label={`Remover ${e.name}`} onClick={() => removeExtra(e.id)} className="grid h-8 w-8 place-items-center rounded-md border border-border-strong text-muted-foreground transition-colors hover:border-destructive hover:text-destructive">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel title="Parcelas no crédito" subtitle="O que ainda vai cair">
            {activeCredits.length === 0 ? (
              <Empty>Nenhuma compra parcelada em curso.</Empty>
            ) : (
              activeCredits.map((c) => {
                const done = Math.max(0, monthsDifference(current, c.startMonth) + 1);
                const remaining = Math.max(0, c.installments - done);
                const end = changeMonth(c.startMonth, c.installments - 1);
                return (
                  <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colorOf(c.category) }} />
                    <div className="min-w-0">
                      <div className="break-words font-semibold">{c.name}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted-foreground">Faltam {remaining} {remaining === 1 ? "parcela" : "parcelas"} · termina em {shortLabel(end)}</div>
                      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-primary" style={{ width: `${(Math.min(done, c.installments) / c.installments) * 100}%` }} /></div>
                    </div>
                    <span className="num font-bold">{formatBRLShort(Math.round(c.totalAmount / c.installments))}</span>
                  </div>
                );
              })
            )}
          </Panel>
        </div>
      </div>

    </>
  );
}
