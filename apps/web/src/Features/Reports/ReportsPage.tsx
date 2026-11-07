import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Panel, { PageHeader } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import { buildCsv, buildTxt, getPeriodTotals, lastMonths } from "@/domain";
import { formatBRLShort } from "@/lib/money";
import { downloadText } from "@/Services/download";
import { useFinanceStore } from "@/Store/FinanceStore";
import { formatMonth } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

type Period = 1 | 3 | 6;
type Format = "PDF" | "CSV" | "TXT";

const PERIODS: { value: Period; label: string }[] = [
  { value: 1, label: "Mês visto" },
  { value: 3, label: "Últimos 3 meses" },
  { value: 6, label: "Últimos 6 meses" },
];

const CONTENT = [
  { key: "summary", label: "Resumo de renda, despesas e saldo" },
  { key: "entries", label: "Lista de lançamentos" },
  { key: "credit", label: "Parcelas do crédito" },
  { key: "distribution", label: "Sugestão de distribuição do saldo (só PDF de um mês)" },
] as const;

const chip = "rounded-full border border-border-strong bg-card px-3.5 py-[7px] text-[13px] font-semibold text-ink2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

export default function ReportsPage() {
  const current = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);

  const [period, setPeriod] = useState<Period>(1);
  const [format, setFormat] = useState<Format>("PDF");
  const [content, setContent] = useState({ summary: true, entries: true, credit: true, distribution: false });

  const data = useMemo(() => ({ transactions, creditTransactions }), [transactions, creditTransactions]);
  const sixMonths = useMemo(() => lastMonths(current, 6), [current]);
  const six = useMemo(() => getPeriodTotals(data, sixMonths), [data, sixMonths]);
  const avg = (v: number) => formatBRLShort(Math.round(v / 6));

  async function doExport() {
    const months = lastMonths(current, period);
    const totals = getPeriodTotals(data, months);
    if (totals.income === 0 && totals.expense === 0) {
      showToast({ type: "error", text: "Não há lançamentos no período escolhido" });
      return;
    }
    if (!content.summary && !content.entries && !content.credit && !(format === "PDF" && content.distribution)) {
      showToast({ type: "error", text: "Marque ao menos um conteúdo para exportar" });
      return;
    }

    const options = { summary: content.summary, entries: content.entries, credit: content.credit };
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
      <PageHeader title="Relatórios" subtitle="Resumo do semestre e exportação em PDF, CSV ou TXT." />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard label="Renda em 6 meses" value={formatBRLShort(six.income)} hint={`média de ${avg(six.income)} por mês`} />
        <StatCard label="Despesas em 6 meses" value={formatBRLShort(six.expense)} hint={`média de ${avg(six.expense)} por mês`} />
        <StatCard label="Economia acumulada" value={formatBRLShort(six.balance)} hint={six.income > 0 ? `${Math.round((six.balance / six.income) * 100)}% da renda` : "Sem renda no período"} highlight />
        <StatCard label="Maior categoria" value={six.topCategory ? six.topCategory.category.replace("/Parcelado", "") : "—"} hint={six.topCategory ? `${formatBRLShort(six.topCategory.value)} no período` : "Sem despesas no período"} />
      </div>

      <div className="mt-3.5 grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12 min-w-0 lg:col-span-7">
          <Panel title="Resumo mês a mês" subtitle="Base do relatório">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="py-1.5 font-semibold">Mês</th>
                    <th className="text-right font-semibold">Renda</th>
                    <th className="text-right font-semibold">Despesas</th>
                    <th className="text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {six.months.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className="py-2.5 font-semibold">{formatMonth(m.month)}</td>
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
          <Panel title="Exportar relatório" subtitle="Escolha o período e o formato">
            <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Período</p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={chip}>{p.label}</button>
              ))}
            </div>

            <p className="mb-2 mt-[18px] text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Formato</p>
            <div className="flex flex-wrap gap-2">
              {(["PDF", "CSV", "TXT"] as Format[]).map((f) => (
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
              {CONTENT.map((c) => (
                <label key={c.key} className="flex items-center gap-2.5 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={content[c.key]}
                    onChange={(e) => setContent({ ...content, [c.key]: e.target.checked })}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  {c.label}
                </label>
              ))}
            </div>

            <div className="mt-4">
              <button type="button" onClick={doExport} className={btnClass.primary}>
                <Icon name="down" size={16} />
                Exportar {format}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
