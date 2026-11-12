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
  getBusinessSummary,
  getInvestmentTotals,
  getPortfolioSummary,
  isBusiness,
  getUpcomingMaturities,
  rateLabel,
  todayISO,
} from "@/domain";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { useFinanceStore, type Investment, type InvestmentMovement } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { getDemoInvestments } from "./demo";
import { HistoryDialog, InvestmentDialog, MovementDialog } from "./InvestmentDialogs";

const color = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;
const percent = (r: number | null) => (r === null ? "—" : `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatBRLShort(Math.abs(cents))}`;

function dueLabel(days: number) {
  if (days < 0) return `venceu há ${-days} ${-days === 1 ? "dia" : "dias"}`;
  if (days === 0) return "vence hoje";
  return `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
}

const noop = () => {};

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-3.5">
      <h3 className="font-display text-[19px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
    </header>
  );
}

function InvestmentCard({ inv, movements, first, onMove, onHistory, onEdit, onDelete }: { inv: Investment; movements: InvestmentMovement[]; first: boolean; onMove: () => void; onHistory: () => void; onEdit: () => void; onDelete: () => void }) {
  const t = getInvestmentTotals(inv, movements);
  const business = isBusiness(inv);
  const tone = t.profit > 0 ? "text-success" : t.profit < 0 ? "text-destructive" : "text-muted-foreground";
  const rows: [string, string][] = business
    ? [
        ["Investido", formatBRL(t.contributed)],
        ["Recebido", formatBRL(t.received)],
        ["Já sacado", formatBRL(t.redeemed)],
        ["Falta recuperar", t.profit < 0 ? formatBRL(-t.profit) : "nada, já recuperou"],
      ]
    : [
    ["Aportado", formatBRL(t.contributed)],
    ...(t.redeemed > 0 ? ([["Resgatado", formatBRL(t.redeemed)]] as [string, string][]) : []),
    ...(inv.rate || inv.indexer ? ([[inv.rate ? "Taxa" : "Indexador", rateLabel(inv)]] as [string, string][]) : []),
    ...(inv.maturityDate ? ([["Vencimento", formatDateBR(inv.maturityDate)]] as [string, string][]) : []),
    ...(inv.liquidity ? ([["Liquidez", inv.liquidity]] as [string, string][]) : []),
    ...(inv.graceUntil ? ([["Carência até", formatDateBR(inv.graceUntil)]] as [string, string][]) : []),
    ...(inv.quantity ? ([["Cotas", `${inv.quantity.toLocaleString("pt-BR")}${inv.avgPrice ? ` a ${formatBRL(inv.avgPrice)}` : ""}`]] as [string, string][]) : []),
    ...(inv.redeemDays != null ? ([["Resgate", `D+${inv.redeemDays}`]] as [string, string][]) : []),
    ...(inv.fees ? ([["Taxas e imposto", inv.fees]] as [string, string][]) : []),
      ];

  return (
    <article data-tour={first ? "investimento" : undefined} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold">{inv.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill>{inv.product || FAMILY_LABEL[inv.family]}</Pill>
            {!business && <Pill>{inv.institution}</Pill>}
            {inv.ticker && <Pill>{inv.ticker}</Pill>}
          </div>
        </div>
        <div className="text-right">
          <span className="num block text-[22px] font-semibold">{formatBRLShort(inv.currentValue)}</span>
          {business && <span className="text-[11.5px] text-muted-foreground">a sacar</span>}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
        <span className="text-muted-foreground">{business ? (t.profit < 0 ? "Em prejuízo" : "Lucro") : "Lucro / prejuízo"}</span>
        <b className={`num ${tone}`}>{signed(t.profit)} ({percent(t.returnRate)})</b>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2 text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <b className="num">{value}</b>
        </div>
      ))}
      {inv.notes && <p className="border-t border-border pt-2.5 text-[12.5px] text-ink2">{inv.notes}</p>}
      <div data-tour={first ? "investimento-acoes" : undefined} className="flex flex-wrap gap-2">
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

  // durante o tour, quem ainda não cadastrou nada vê investimentos de exemplo (nunca gravados nem somados nos totais)
  const demo = useUiStore((s) => s.tourDemo) && investments.length === 0;
  const demoData = useMemo(() => (demo ? getDemoInvestments() : null), [demo]);
  const shown = demoData?.investments ?? investments;
  const shownMovements = demoData?.movements ?? movements;

  const summary = useMemo(() => getPortfolioSummary(investments, movements), [investments, movements]);
  const business = useMemo(() => getBusinessSummary(shown, shownMovements), [shown, shownMovements]);
  const marketShown = useMemo(() => shown.filter((i) => !isBusiness(i)), [shown]);
  const businessShown = useMemo(() => shown.filter(isBusiness), [shown]);
  const financialCount = investments.filter((i) => !isBusiness(i)).length;
  const shownSummary = useMemo(() => (demoData ? getPortfolioSummary(demoData.investments, demoData.movements) : summary), [demoData, summary]);
  const maturities = useMemo(() => getUpcomingMaturities(marketShown, todayISO()), [marketShown]);

  const [editing, setEditing] = useState<Investment | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Investment | null>(null);
  const [editingMovement, setEditingMovement] = useState<InvestmentMovement | null>(null);
  const [history, setHistory] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);

  // os diálogos recebem o investimento atualizado da store
  const fresh = (i: Investment | null) => (i ? investments.find((x) => x.id === i.id) ?? i : null);
  const renderCard = (inv: Investment, first: boolean) =>
    demo ? (
      <InvestmentCard key={inv.id} inv={inv} movements={shownMovements} first={first} onMove={noop} onHistory={noop} onEdit={noop} onDelete={noop} />
    ) : (
      <InvestmentCard key={inv.id} inv={inv} movements={movements} first={first} onMove={() => setMoving(inv)} onHistory={() => setHistory(inv)} onEdit={() => setEditing(inv)} onDelete={() => setDeleting(inv)} />
    );
  const profitTone = summary.profit > 0 ? "good" : summary.profit < 0 ? "bad" : "default";

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <button type="button" data-tour="novo" onClick={() => setCreating(true)} className={btnClass.primary}>
          <Icon name="plus" size={14} />
          Novo investimento
        </button>
      </div>

      <SectionHeader title="Investimentos de mercado" subtitle="CDB, Tesouro, ações, FIIs, fundos..." />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard tour="patrimonio" label="Patrimônio investido" value={formatBRLShort(summary.netWorth)} hint={`${financialCount} ${financialCount === 1 ? "investimento" : "investimentos"}`} highlight />
        <StatCard tour="aportado" label="Total aportado" value={formatBRLShort(summary.contributed)} hint={summary.redeemed > 0 ? `${formatBRLShort(summary.redeemed)} já resgatados` : "somando todos os aportes"} />
        <StatCard tour="lucro" label="Lucro / prejuízo" value={signed(summary.profit)} tone={profitTone} hint="valor atual + resgates − aportes" />
        <StatCard tour="rentabilidade" label="Rentabilidade" value={percent(summary.returnRate)} tone={profitTone} hint="lucro sobre o total aportado" />
      </div>

      {marketShown.length === 0 && !demo && (
        <div className="mt-3.5">
          <Panel tour="vazio" title="Nenhum investimento de mercado" subtitle="Registro manual, sem integração com bancos ou corretoras">
            <Empty>
              {businessShown.length > 0
                ? "Use “Novo investimento” para registrar um CDB, um fundo ou ações e acompanhar o patrimônio aqui."
                : "Use “Novo investimento” para registrar um CDB, um fundo, ações ou o que você tiver. Para acompanhar um negócio seu (revenda, por exemplo), escolha “Negócio próprio”: investido, recebido, sacado e lucro."}
            </Empty>
          </Panel>
        </div>
      )}

      {demo && (
        <p role="note" className="mt-3.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <b className="text-foreground">Exemplo ilustrativo.</b> Estes investimentos são fictícios, só para mostrar como a tela fica depois que você cadastrar os seus.
        </p>
      )}

      {marketShown.length > 0 && (
        <>
          {shownSummary.byFamily.length > 0 && (
            <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
              <Panel tour="por-tipo" title="Por tipo" subtitle="Onde está o seu dinheiro">
                <ChartDonut slices={shownSummary.byFamily.map((x, i) => ({ label: FAMILY_LABEL[x.key], value: x.value, color: color(i) }))} />
              </Panel>
              <Panel tour="por-instituicao" title="Por instituição" subtitle="Em qual banco ou corretora">
                <ChartDonut slices={shownSummary.byInstitution.map((x, i) => ({ label: x.key, value: x.value, color: color(i) }))} />
              </Panel>
            </div>
          )}

          {maturities.length > 0 && (
            <div className="mt-3.5">
              <Panel tour="vencimentos" title="Próximos vencimentos" subtitle="Nos próximos 90 dias">
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
            {marketShown.map((inv, i) => renderCard(inv, i === 0))}
          </div>
        </>
      )}

      {businessShown.length > 0 && (
        <section aria-label="Meus negócios" data-tour="negocios" className="mt-10 border-t border-border pt-6">
          <SectionHeader title="Meus negócios" subtitle="O que você investiu, recebeu das vendas e já sacou" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
            <StatCard label="Investido" value={formatBRLShort(business.invested)} hint="soma dos investimentos" />
            <StatCard label="Recebido" value={formatBRLShort(business.received)} hint="vendas que entraram" />
            <StatCard label="Já sacado" value={formatBRLShort(business.withdrawn)} hint={`${formatBRLShort(business.available)} ainda a sacar`} />
            <StatCard
              label={business.profit < 0 ? "Prejuízo" : "Lucro"}
              value={signed(business.profit)}
              tone={business.profit > 0 ? "good" : business.profit < 0 ? "bad" : "default"}
              hint={business.profit < 0 ? "ainda não recuperou o investido" : `${percent(business.returnRate)} sobre o investido`}
            />
          </div>
          <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {businessShown.map((inv) => renderCard(inv, false))}
          </div>
        </section>
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
        itemLabel={deleting ? `${isBusiness(deleting) ? "negócio" : "investimento"} "${deleting.name}"${isBusiness(deleting) ? "" : ` (${formatBRL(deleting.currentValue)})`} e o histórico dele` : "investimento"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeInvestment(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
