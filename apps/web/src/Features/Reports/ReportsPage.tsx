import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import { buildCsv, buildTxt, dayMonth, describePaidBadge, getPeriodTotals, getReportInvoices, invoiceTitle, isScheduled, type ReportInvoice } from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { downloadText } from "@/Services/download";
import { useFinanceStore } from "@/Store/FinanceStore";
import { changeMonth, formatMonth, formatMonthShort, getCurrentMonth, getMonthsBetween, monthsDifference } from "@/Utils/Date";
import { Field } from "@/components/shared/FormFields";
import MonthPicker from "@/components/shared/MonthPicker";
import { showToast } from "../Warnings/toast";
import { loadReportPrefs, sameReportPrefs, saveReportPrefs, type ReportFormat } from "./prefs";
import { RELATORIOS_TOUR } from "./tour";

const CONTENT = [
  { key: "summary", label: "Resumo de renda, despesas e saldo" },
  { key: "entries", label: "Lista de lançamentos" },
  { key: "credit", label: "Parcelas do crédito" },
  { key: "invoices", label: "Faturas dos cartões (cada uma com o total e a descrição dos gastos)" },
  { key: "distribution", label: "Sugestão de distribuição do saldo (só no PDF; com vários meses usa o saldo somado)" },
] as const;

const MAX_MONTHS = 6;

/** Uma fatura: o título com o nome do cartão e o total, e embaixo a descrição dos gastos. */
function InvoiceBlock({ invoice }: { invoice: ReportInvoice }) {
  const { payment } = invoice;
  return (
    <div className="rounded-md border border-border bg-secondary p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words font-semibold">{invoiceTitle(invoice)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>{formatMonth(invoice.month)}</span>
            <span>Fecha {dayMonth(invoice.closingDate)}</span>
            <span>Vence {dayMonth(invoice.dueDate)}</span>
            {payment && <Pill tone={isScheduled(payment) ? "scheduled" : "good"}>{describePaidBadge(payment)}</Pill>}
          </div>
        </div>
        <span className="num flex-none text-right font-bold">{formatBRL(invoice.total)}</span>
      </div>
      {invoice.items.length > 0 && (
        <ul className="mt-2.5 flex flex-col border-t border-border pt-1.5">
          {invoice.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
              <span className="min-w-0 break-words">{item.description}</span>
              <span className="num flex-none font-semibold">{formatBRL(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const current = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);

  // null = acompanha o seletor do cabeçalho (os 6 meses que terminam nele)
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
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
  const range = custom ?? { start: changeMonth(current, -(MAX_MONTHS - 1)), end: current };
  const months = useMemo(() => getMonthsBetween(range.start, range.end), [range.start, range.end]);
  const total = useMemo(() => getPeriodTotals(data, months), [data, months]);
  const invoices = useMemo(() => getReportInvoices(data, months), [data, months]);
  const count = months.length;
  const avg = (v: number) => formatBRLShort(Math.round(v / count));

  /** Ao mudar o início, o fim acompanha para manter no máximo 6 meses (e não passar do mês atual). */
  function setStart(start: string) {
    if (!start || monthsDifference(start, maxMonth) > 0) return;
    let end = range.end;
    if (monthsDifference(end, start) < 0) end = start;
    if (monthsDifference(end, start) > MAX_MONTHS - 1) end = changeMonth(start, MAX_MONTHS - 1);
    if (monthsDifference(end, maxMonth) > 0) end = maxMonth;
    setCustom({ start, end });
  }

  /** Ao mudar o fim, o início acompanha pelo mesmo motivo. */
  function setEnd(end: string) {
    if (!end || monthsDifference(end, maxMonth) > 0) return;
    let start = range.start;
    if (monthsDifference(end, start) < 0) start = end;
    if (monthsDifference(end, start) > MAX_MONTHS - 1) start = changeMonth(end, -(MAX_MONTHS - 1));
    setCustom({ start, end });
  }

  async function doExport() {
    if (total.income === 0 && total.expense === 0) {
      showToast({ type: "error", text: "Não há lançamentos no período escolhido" });
      return;
    }
    if (!content.summary && !content.entries && !content.credit && !content.invoices && !(format === "PDF" && content.distribution)) {
      showToast({ type: "error", text: "Marque ao menos um conteúdo para exportar" });
      return;
    }

    const options = { summary: content.summary, entries: content.entries, credit: content.credit, invoices: content.invoices };
    const name = `relatorio-${months[0]}${months.length > 1 ? `_a_${months[months.length - 1]}` : ""}`;

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
      <PageHeader tour={RELATORIOS_TOUR} title="Relatórios" subtitle="Resumo de até 6 meses, à sua escolha, e exportação em PDF, CSV ou TXT." />

      <Panel tour="periodo" title="Período" subtitle={`${formatMonth(range.start)} a ${formatMonth(range.end)} · ${count} ${count === 1 ? "mês" : "meses"}`}>
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="w-full sm:w-48">
            <Field label="Início" htmlFor="report-start">
              <MonthPicker id="report-start" value={range.start} max={maxMonth} onChange={setStart} />
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="Fim" htmlFor="report-end">
              <MonthPicker id="report-end" value={range.end} max={maxMonth} onChange={setEnd} />
            </Field>
          </div>
          {custom && (
            <button type="button" onClick={() => setCustom(null)} className={btnClass.base}>Usar o mês do seletor</button>
          )}
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          {custom ? "Período escolhido por você." : "Acompanha o mês do seletor do topo (ele é o último mês)."} O intervalo vai de 1 a {MAX_MONTHS} meses, e os cartões, a tabela e a exportação usam este período.
        </p>
      </Panel>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard tour="renda" label="Renda no período" value={formatBRLShort(total.income)} hint={`média de ${avg(total.income)} por mês`} />
        <StatCard tour="despesas" label="Despesas no período" value={formatBRLShort(total.expense)} hint={`média de ${avg(total.expense)} por mês`} />
        <StatCard tour="economia" label="Economia acumulada" value={formatBRLShort(total.balance)} hint={total.income > 0 ? `${Math.round((total.balance / total.income) * 100)}% da renda` : "Sem renda no período"} highlight />
        <StatCard tour="categoria" label="Maior categoria" value={total.topCategory ? total.topCategory.category.replace("/Parcelado", "") : "—"} hint={total.topCategory ? `${formatBRLShort(total.topCategory.value)} no período` : "Sem despesas no período"} />
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

          <div className="mt-3.5">
            <Panel tour="faturas" title="Faturas dos cartões" subtitle="Cada fatura reúne parcelas, recorrências e compras avulsas do cartão">
              {invoices.length === 0 ? (
                <Empty>Nenhuma fatura de cartão neste período.</Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {invoices.map((i) => <InvoiceBlock key={`${i.month}-${i.cardName}`} invoice={i} />)}
                  <p className="text-[12.5px] text-muted-foreground">As faturas só agrupam lançamentos que já estão nos totais do período: nada é somado de novo.</p>
                </div>
              )}
            </Panel>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Panel tour="exportar" title="Exportar relatório" subtitle={`${formatMonth(range.start)} a ${formatMonth(range.end)}`}>
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
      </div>
    </>
  );
}
