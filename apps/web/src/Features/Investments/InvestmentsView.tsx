import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import ChartDonut from "@/components/charts/ChartDonut";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Panel, { Empty, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import StatCard from "@/components/shared/StatCard";
import {
  FAMILY_LABEL,
  formatDateBR,
  getInvestmentTotals,
  getPortfolioSummary,
  getUpcomingMaturities,
  rateLabel,
  todayISO,
} from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore, type Investment, type InvestmentMovement } from "@/Store/FinanceStore";
import { HistoryDialog, InvestmentDialog, MovementDialog } from "./InvestmentDialogs";

const color = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;
const percent = (r: number | null) => (r === null ? "—" : `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatBRLShort(Math.abs(cents))}`;

function dueLabel(days: number) {
  if (days < 0) return `venceu há ${-days} ${-days === 1 ? "dia" : "dias"}`;
  if (days === 0) return "vence hoje";
  return `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
}

function InvestmentCard({ inv, onMove, onHistory, onEdit, onDelete }: { inv: Investment; onMove: () => void; onHistory: () => void; onEdit: () => void; onDelete: () => void }) {
  const movements = useFinanceStore((s) => s.investmentMovements);
  const t = getInvestmentTotals(inv, movements);
  const tone = t.profit > 0 ? "text-success" : t.profit < 0 ? "text-destructive" : "text-muted-foreground";
  const rows: [string, string][] = [
    ["Aportado", formatBRL(t.contributed)],
    ...(t.redeemed > 0 ? ([["Resgatado", formatBRL(t.redeemed)]] as [string, string][]) : []),
    ...(inv.rate || inv.indexer ? ([[inv.rate ? "Taxa" : "Indexador", rateLabel(inv)]] as [string, string][]) : []),
    ...(inv.maturityDate ? ([["Vencimento", formatDateBR(inv.maturityDate)]] as [string, string][]) : []),
    ...(inv.liquidity ? ([["Liquidez", inv.liquidity]] as [string, string][]) : []),
    ...(inv.graceUntil ? ([["Carência até", formatDateBR(inv.graceUntil)]] as [string, string][]) : []),
    ...(inv.quantity ? ([["Cotas", `${inv.quantity.toLocaleString("pt-BR")}${inv.avgPrice ? ` a ${formatBRL(inv.avgPrice)}` : ""}`]] as [string, string][]) : []),
    ...(inv.redeemDays != null ? ([["Resgate", `D+${inv.redeemDays}`]] as [string, string][]) : []),
  ];

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold">{inv.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill>{inv.product || FAMILY_LABEL[inv.family]}</Pill>
            <Pill>{inv.institution}</Pill>
            {inv.ticker && <Pill>{inv.ticker}</Pill>}
          </div>
        </div>
        <span className="num text-[22px] font-semibold">{formatBRLShort(inv.currentValue)}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Lucro / prejuízo</span>
        <b className={`num ${tone}`}>{signed(t.profit)} ({percent(t.returnRate)})</b>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2 text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <b className="num">{value}</b>
        </div>
      ))}
      {inv.notes && <p className="border-t border-border pt-2.5 text-[12.5px] text-ink2">{inv.notes}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onMove} className={`${btnClass.primary} ${btnClass.sm}`}>
          <Icon name="plus" size={14} />
          Movimentar
        </button>
        <button type="button" onClick={onHistory} className={`${btnClass.base} ${btnClass.sm}`}>Histórico</button>
        <button type="button" onClick={onEdit} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
        <button type="button" onClick={onDelete} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
          <Icon name="trash" size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

/** Visão "Investimentos" da tela Metas e Investimentos. */
export default function InvestmentsView() {
  const investments = useFinanceStore((s) => s.investments);
  const movements = useFinanceStore((s) => s.investmentMovements);
  const removeInvestment = useFinanceStore((s) => s.removeInvestment);

  const summary = useMemo(() => getPortfolioSummary(investments, movements), [investments, movements]);
  const maturities = useMemo(() => getUpcomingMaturities(investments, todayISO()), [investments]);

  const [editing, setEditing] = useState<Investment | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Investment | null>(null);
  const [editingMovement, setEditingMovement] = useState<InvestmentMovement | null>(null);
  const [history, setHistory] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);

  // os diálogos recebem o investimento atualizado da store
  const fresh = (i: Investment | null) => (i ? investments.find((x) => x.id === i.id) ?? i : null);
  const profitTone = summary.profit > 0 ? "good" : summary.profit < 0 ? "bad" : "default";

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <button type="button" onClick={() => setCreating(true)} className={btnClass.primary}>
          <Icon name="plus" size={14} />
          Novo investimento
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard label="Patrimônio investido" value={formatBRLShort(summary.netWorth)} hint={`${investments.length} ${investments.length === 1 ? "investimento" : "investimentos"}`} highlight />
        <StatCard label="Total aportado" value={formatBRLShort(summary.contributed)} hint={summary.redeemed > 0 ? `${formatBRLShort(summary.redeemed)} já resgatados` : "somando todos os aportes"} />
        <StatCard label="Lucro / prejuízo" value={signed(summary.profit)} tone={profitTone} hint="valor atual + resgates − aportes" />
        <StatCard label="Rentabilidade" value={percent(summary.returnRate)} tone={profitTone} hint="lucro sobre o total aportado" />
      </div>

      {investments.length === 0 ? (
        <div className="mt-3.5">
          <Panel title="Nenhum investimento ainda" subtitle="Registro manual, sem integração com bancos ou corretoras">
            <Empty>Use “Novo investimento” para registrar um CDB, um fundo, ações ou o que você tiver, e acompanhe o patrimônio aqui.</Empty>
          </Panel>
        </div>
      ) : (
        <>
          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
            <Panel title="Por tipo" subtitle="Onde está o seu dinheiro">
              <ChartDonut slices={summary.byFamily.map((x, i) => ({ label: FAMILY_LABEL[x.key], value: x.value, color: color(i) }))} />
            </Panel>
            <Panel title="Por instituição" subtitle="Em qual banco ou corretora">
              <ChartDonut slices={summary.byInstitution.map((x, i) => ({ label: x.key, value: x.value, color: color(i) }))} />
            </Panel>
          </div>

          {maturities.length > 0 && (
            <div className="mt-3.5">
              <Panel title="Próximos vencimentos" subtitle="Nos próximos 90 dias">
                <ul className="flex flex-col divide-y divide-border">
                  {maturities.map(({ investment: i, days }) => (
                    <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[13px]">
                      <span className="min-w-0 break-words font-semibold">{i.name} <span className="font-normal text-muted-foreground">· {i.institution}</span></span>
                      <span className={days < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                        {formatDateBR(i.maturityDate!)} · {dueLabel(days)} · <b className="num text-foreground">{formatBRLShort(i.currentValue)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {investments.map((inv) => (
              <InvestmentCard key={inv.id} inv={inv} onMove={() => setMoving(inv)} onHistory={() => setHistory(inv)} onEdit={() => setEditing(inv)} onDelete={() => setDeleting(inv)} />
            ))}
          </div>
        </>
      )}

      <InvestmentDialog open={creating || !!editing} investment={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <MovementDialog investment={fresh(moving)} movement={editingMovement} open={!!moving} onClose={() => { setMoving(null); setEditingMovement(null); }} />
      <HistoryDialog
        investment={fresh(history)}
        open={!!history && !moving}
        onClose={() => setHistory(null)}
        onEdit={(m) => { setEditingMovement(m); setMoving(history); }}
      />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `investimento "${deleting.name}" (${formatBRL(deleting.currentValue)}) e o histórico dele` : "investimento"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeInvestment(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
