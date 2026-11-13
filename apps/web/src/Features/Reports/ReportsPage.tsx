import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Panel, { PageHeader } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import { buildCsv, buildTxt, formatPaymentDate, formatPeriodLabel, getPeriodTotals, periodFileName, sortMonths } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { downloadText } from "@/Services/download";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { usePagination } from "@/lib/usePagination";
import Pager from "@/components/shared/Pager";
import { changeMonth, formatMonth, formatMonthAbbr, formatMonthShort, getCurrentMonth, getMonthsBetween, monthsDifference } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";
import { loadReportPrefs, sameReportPrefs, saveReportPrefs, type ReportFormat } from "./prefs";
import { RELATORIOS_TOUR } from "./tour";
import { useTransactions } from "@/Store/selectors";

const CONTENT = [
  { key: "summary", label: "Resumo de renda, despesas e saldo" },
  { key: "entries", label: "Lista de lançamentos" },
  { key: "invoices", label: "Faturas dos cartões (parcelas, recorrências, compras avulsas e ajustes de cada uma)" },
  { key: "distribution", label: "Sugestão de distribuição do saldo (só no PDF; com vários meses usa o saldo somado)" },
] as const;

const MAX_MONTHS = 12;

export default function ReportsPage() {
  const current = useFinanceStore((s) => s.currentMonth);
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const realClosings = useFinanceStore((s) => s.closings);
  // durante o tour, sem nenhum mês fechado, a tela mostra exemplos fictícios (nunca gravados)
  const demoClosings = useUiStore((s) => s.tourDemo) && Object.keys(realClosings).length === 0;
  const closings = demoClosings
    ? { [changeMonth(current, -2)]: { closedAt: `${changeMonth(current, -1)}-03`, income: 560000, expense: 410000, balance: 150000, byCategory: {}, note: "Exemplo ilustrativo" }, [changeMonth(current, -3)]: { closedAt: `${changeMonth(current, -2)}-03`, income: 560000, expense: 450000, balance: 110000, byCategory: {}, note: "Exemplo ilustrativo" } }
    : realClosings;
  const closedMonths = Object.keys(closings).sort().reverse();
  const [closedYear, setClosedYear] = useState("");
  const [closedPerPage, setClosedPerPage] = useState(3);
  const closedYears = [...new Set(closedMonths.map((m) => m.slice(0, 4)))];
  const closedShown = closedMonths.filter((m) => !closedYear || m.startsWith(closedYear));
  const closedPager = usePagination(closedShown, closedPerPage);

  // null = só o mês do seletor do cabeçalho (o padrão); a lista aparece quando o usuário escolhe meses
  const [picked, setPicked] = useState<string[] | null>(null);
  // o que vem marcado ao abrir a tela é o que foi salvo com "Salvar alterações" (ou o padrão)
  const [saved, setSaved] = useState(loadReportPrefs);
  const [format, setFormat] = useState<ReportFormat>(saved.format);
  const [content, setContent] = useState(saved.content);
  const unsaved = !sameReportPrefs({ format, content }, saved);

  function savePrefs() {
    const prefs = { format, content };
    if (!saveReportPrefs(prefs)) {
      showToast({ type: "error", text: "Não foi possível salvar: o navegador não deixou guardar a preferência" });
      return;
    }
    setSaved(prefs);
    showToast({ type: "success", text: "Preferências do relatório salvas: a tela abre assim da próxima vez" });
  }

  const data = useMemo(() => ({ transactions, creditTransactions, creditCards, extraExpenses }), [transactions, creditTransactions, creditCards, extraExpenses]);
  const maxMonth = getCurrentMonth();
  const months = useMemo(() => sortMonths(picked ?? [current]), [picked, current]);
  // os 12 meses até o atual (ou até o mês do seletor, se ele for mais novo), mais qualquer mês já escolhido fora dessa janela
  const options = useMemo(() => {
    const end = monthsDifference(current, maxMonth) > 0 ? current : maxMonth;
    return sortMonths([...getMonthsBetween(changeMonth(end, -(MAX_MONTHS - 1)), end), ...months]);
  }, [current, maxMonth, months]);
  const total = useMemo(() => getPeriodTotals(data, months), [data, months]);
  const count = months.length;
  const avg = (v: number) => formatBRLShort(Math.round(v / count));

  /** Marca ou desmarca um mês. Fica sempre ao menos um, e no máximo MAX_MONTHS. */
  function toggle(month: string) {
    if (months.includes(month)) {
      if (months.length > 1) setPicked(months.filter((m) => m !== month));
    } else if (months.length < MAX_MONTHS) {
      setPicked([...months, month]);
    }
  }

  /** Os `n` meses que terminam no mês do seletor do topo. */
  const lastN = (n: number) => getMonthsBetween(changeMonth(current, -(n - 1)), current);

  async function doExport() {
    if (total.income === 0 && total.expense === 0) {
      showToast({ type: "error", text: "Não há lançamentos no período escolhido" });
      return;
    }
    if (!content.summary && !content.entries && !content.invoices && !(format === "PDF" && content.distribution)) {
      showToast({ type: "error", text: "Marque ao menos um conteúdo para exportar" });
      return;
    }

    const options = { summary: content.summary, entries: content.entries, invoices: content.invoices };
    const name = periodFileName(months);

    // o gerador de PDF é pesado: só é carregado quando alguém pede um PDF
    if (format === "PDF") {
      const { exportPDF } = await import("@/Services/exportPDF");
      exportPDF(months, { ...options, distribution: content.distribution });
    }
    else if (format === "CSV") downloadText(`${name}.csv`, buildCsv(data, months, options), "text/csv", true);
    else downloadText(`${name}.txt`, buildTxt(data, months, options), "text/plain");

    showToast({ type: "success", text: `Relatório ${format} gerado` });
  }

  return (
    <>
      <PageHeader tour={RELATORIOS_TOUR} title="Relatórios" subtitle="Escolha os meses que quer ver (começa só com o mês atual) e exporte em PDF, CSV ou TXT." />

      <Panel tour="periodo" title="Período" subtitle={`${formatPeriodLabel(months)} · ${count} ${count === 1 ? "mês" : "meses"}`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Meses do relatório">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={months.includes(m)}
              onClick={() => toggle(m)}
              className="rounded-full max-sm:min-h-10 border border-border-strong bg-card px-3.5 py-[7px] text-[13px] font-semibold text-ink2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-[0_6px_18px_color-mix(in_srgb,hsl(var(--primary))_35%,transparent)]"
            >
              {`${formatMonthAbbr(m)}/${m.slice(2, 4)}`}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPicked(null)} className={btnClass.base}>Mês atual</button>
          <button type="button" onClick={() => setPicked(lastN(3))} className={btnClass.base}>Últimos 3 meses</button>
          <button type="button" onClick={() => setPicked(lastN(6))} className={btnClass.base}>Últimos 6 meses</button>
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          {picked ? "Meses escolhidos por você." : "Só o mês do seletor do topo."} Marque ou desmarque os meses (de 1 a {MAX_MONTHS}); os cartões, a tabela e a exportação usam só eles.
        </p>
      </Panel>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard tour="renda" label="Renda no período" value={formatBRLShort(total.income)} hint={`média de ${avg(total.income)} por mês`} />
        <StatCard tour="despesas" label="Despesas no período" value={formatBRLShort(total.expense)} hint={`média de ${avg(total.expense)} por mês`} />
        <StatCard tour="economia" label="Economia acumulada" value={formatBRLShort(total.balance)} hint={total.income > 0 ? `${Math.round((total.balance / total.income) * 100)}% da renda` : "Sem renda no período"} highlight />
        <StatCard tour="categoria" label="Maior categoria" value={total.topCategory ? total.topCategory.category : "—"} hint={total.topCategory ? `${formatBRLShort(total.topCategory.value)} no período` : "Sem despesas no período"} />
      </div>

      <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12 min-w-0 lg:col-span-7">
          <Panel tour="resumo" title="Resumo mês a mês" subtitle="Base do relatório">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="py-1.5 font-semibold">Mês</th>
                    <th className="text-right font-semibold">Renda</th>
                    <th className="text-right font-semibold">Despesas</th>
                    <th className="text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {total.months.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className="py-2.5 font-semibold"><span className="sm:hidden">{formatMonthShort(m.month)}</span><span className="max-sm:hidden">{formatMonth(m.month)}</span></td>
                      <td className="num text-right">{formatBRLShort(m.totalIncome)}</td>
                      <td className="num text-right">{formatBRLShort(m.totalExpense)}</td>
                      <td className={`num text-right font-bold ${m.balance < 0 ? "text-destructive" : "text-success"}`}>{formatBRLShort(m.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Panel tour="exportar" title="Exportar relatório" subtitle={formatPeriodLabel(months)}>
            <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Formato</p>
            <div className="flex flex-wrap gap-2">
              {(["PDF", "CSV", "TXT"] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                  className="flex items-center gap-2 rounded-md border border-border-strong bg-card px-3.5 py-2.5 text-[13px] font-semibold aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:shadow-[inset_0_0_0_1px_hsl(var(--primary))]"
                >
                  <Icon name="relatorios" size={16} />
                  {f}
                </button>
              ))}
            </div>

            <div className="mb-1 mt-3.5 flex flex-col gap-2.5">
              {CONTENT.map((c) => {
                // a sugestão de distribuição só existe no PDF: com CSV ou TXT o campo fica bloqueado (e desmarcado na tela)
                const blocked = c.key === "distribution" && format !== "PDF";
                return (
                  <label key={c.key} className={`flex items-start gap-2.5 text-[13.5px] ${blocked ? "cursor-not-allowed opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={blocked ? false : content[c.key]}
                      disabled={blocked}
                      onChange={(e) => setContent({ ...content, [c.key]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))] disabled:cursor-not-allowed"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={doExport} className={btnClass.primary}>
                <Icon name="down" size={16} />
                Exportar {format}
              </button>
              <button type="button" onClick={savePrefs} disabled={!unsaved} className={`${btnClass.base} disabled:cursor-not-allowed disabled:opacity-50`}>
                <Icon name="check" size={16} />
                Salvar alterações
              </button>
            </div>
            <p className="mt-2 text-[12.5px] text-muted-foreground" role="status">
              {unsaved ? "Você mudou o formato ou o conteúdo. Salve para a tela abrir assim da próxima vez." : "O formato e o conteúdo marcados acima são o seu padrão salvo neste navegador."}
            </p>
          </Panel>
        </div>

        {closedMonths.length > 0 && (
          <div className="col-span-12">
            <Panel tour="fechados" title="Meses fechados" subtitle="O retrato guardado em cada fechamento (não muda se os lançamentos mudarem depois)">
              {closedMonths.length > 3 && (
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Ano
                    <select value={closedYear} onChange={(e) => { setClosedYear(e.target.value); closedPager.setPage(1); }} className="h-9 rounded-md border border-border-strong bg-card px-2 text-[13px] font-semibold">
                      <option value="">Todos os anos</option>
                      {closedYears.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Meses por página
                    <select value={closedPerPage} onChange={(e) => { setClosedPerPage(Number(e.target.value)); closedPager.setPage(1); }} className="h-9 rounded-md border border-border-strong bg-card px-2 text-[13px] font-semibold">
                      <option value={3}>3</option>
                      <option value={6}>6</option>
                    </select>
                  </label>
                </div>
              )}
              {demoClosings && <p className="mb-2 text-[12.5px] text-muted-foreground"><b className="text-foreground">Exemplo ilustrativo:</b> estes meses são fictícios.</p>}
              <ul className="flex flex-col divide-y divide-border">
                {closedPager.slice.map((m) => {
                  const c = closings[m];
                  return (
                    <li key={m} className="flex flex-col gap-1 py-2.5 text-[13.5px] first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <b>{formatMonthShort(m)}</b>
                        <span className="num text-ink2">renda {formatBRL(c.income)} · despesas {formatBRL(c.expense)} · saldo <b className={c.balance < 0 ? "text-destructive" : "text-foreground"}>{formatBRL(c.balance)}</b></span>
                      </div>
                      <span className="text-[12px] text-muted-foreground">Fechado em {formatPaymentDate(c.closedAt)}{c.note ? ` · “${c.note}”` : ""}</span>
                    </li>
                  );
                })}
              </ul>
              <Pager {...closedPager} onPage={closedPager.setPage} />
              {closedShown.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum mês fechado em {closedYear}.</p>}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
