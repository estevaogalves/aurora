import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChartDonut, { type DonutSlice } from "@/components/charts/ChartDonut";
import ChartLine from "@/components/charts/ChartLine";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { breathingDays, freedomDay, reserveTotal, DEFAULT_DISTRIBUTION, distributeBalance, getCategoryDetail, getMonthSummary, goalPercent, isCardPurchase, overrideKey, sentKey, type DistributionItem, type MonthDistribution, type SentSummary, type SentTarget } from "@/domain";
import HoursHint from "@/components/shared/HoursHint";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { usePrefsStore } from "@/lib/preferences";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { useCategoryTotals, useDistributionItemsFor, useMonthCredit, useMonthDistributions, useMonthSummary, useMonthTransactions, useResolvedExtras, useSentByDistribution } from "@/Store/selectors";
import { useCategoryColor } from "@/Utils/categoryColors";
import { changeMonth, formatMonthShort, formatMonthTitle, getMonthName } from "@/Utils/Date";
import { ExpenseStaticRow, type ExpenseLine } from "../Launch/rows";
import { deadlineStatus, paceHint, useGoalAlerts } from "../Goals/goalAlerts";
import { getDemoGoals } from "../Goals/demo";
import { DistributionDialog } from "./DistributionDialog";
import SendDistributionDialog, { type SendRequest } from "./SendDistributionDialog";
import UndoSendDialog, { type UndoRequest } from "./UndoSendDialog";
import { showToast } from "../Warnings/toast";
import { PAINEL_TOUR } from "./tour";
import TimeSettings from "./TimeSettings";

/** Cor da fatia pela posição na lista (repete depois de 9). */
const sliceColor = (items: { id: string }[], id: string) => `hsl(var(--k${(items.findIndex((i) => i.id === id) % 9) + 1}))`;

function Hero() {
  const month = useFinanceStore((s) => s.currentMonth);
  const { totalIncome, totalExpense, balance, expensePercentage } = useMonthSummary();
  const pct = Math.round(expensePercentage);

  return (
    <section data-tour="saldo" className="flex flex-col gap-1.5 rounded-lg border border-border-strong bg-[linear-gradient(155deg,color-mix(in_srgb,hsl(var(--primary))_38%,hsl(var(--card))),hsl(var(--card))_70%)] p-6 shadow-[var(--shadow-card)]">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink2">Saldo de {getMonthName(month)}</span>
      {/* valor longo é cortado com "…" em vez de empurrar o card (min-w-0 deixa o item da coluna encolher) */}
      <span className={`num block min-w-0 truncate text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] max-[700px]:text-[34px] ${balance < 0 ? "text-destructive" : ""}`}>
        {formatBRL(balance)}
      </span>
      <span className="text-[13.5px] text-ink2">{pct}% da renda comprometida</span>
      <div className="mt-auto pt-3.5">
        <div className="h-2 overflow-hidden rounded-full bg-background/50">
          <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {[
          ["Renda", totalIncome],
          ["Despesas", totalExpense],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md bg-background/40 px-3 py-2.5">
            <small className="block text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{label}</small>
            <b className="num block truncate text-base">{formatBRLShort(value as number)}</b>
            {label === "Despesas" && <HoursHint cents={value as number} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Trend() {
  const month = useFinanceStore((s) => s.currentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);

  const { labels, income, expense } = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => changeMonth(month, i - 5));
    const sums = months.map((m) => getMonthSummary({ transactions, creditTransactions, creditCards, extraExpenses }, m));
    return {
      labels: months.map((m) => { const t = formatMonthShort(m).split(" ")[0]; return t.charAt(0).toUpperCase() + t.slice(1); }),
      income: sums.map((s) => s.totalIncome),
      expense: sums.map((s) => s.totalExpense),
    };
  }, [month, transactions, creditTransactions, creditCards, extraExpenses]);

  return (
    <Panel tour="tendencia" title="Últimos 6 meses" subtitle="Renda e despesas">
      <ChartLine
        labels={labels}
        series={[
          { name: "Renda", color: "hsl(var(--inc))", values: income },
          { name: "Despesas", color: "hsl(var(--exp))", values: expense },
        ]}
      />
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Renda</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Despesas</span>
      </div>
    </Panel>
  );
}

function Categories() {
  const month = useFinanceStore((s) => s.currentMonth);
  const totals = useCategoryTotals();
  const colorOf = useCategoryColor();
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);

  // lançamentos que formam a categoria clicada (o rótulo da fatia é o nome da categoria)
  const detailOf = (slice: DonutSlice) => {
    const lines = getCategoryDetail({ transactions, creditTransactions, creditCards, extraExpenses }, month, slice.label);
    return (
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-[14px] font-semibold">{slice.label}</p>
        {lines.length === 0 ? (
          <p className="text-muted-foreground">Nenhum lançamento.</p>
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
              <span className="num">{formatBRL(slice.value)}</span>
            </li>
          </ul>
        )}
      </div>
    );
  };

  return (
    <Panel tour="categorias" title="Despesas por categoria" subtitle={getMonthName(month).replace(/^./, (c) => c.toUpperCase())}>
      {totals.length === 0 ? (
        <Empty>Nenhuma despesa neste mês.</Empty>
      ) : (
        <ChartDonut renderDetail={detailOf} slices={totals.map((t) => ({ label: t.category, value: t.value, color: colorOf(t.category) }))} />
      )}
    </Panel>
  );
}

const SENT_KIND: Record<SentTarget["kind"], string> = { piggy: "porquinho", goal: "meta", investment: "investimento" };

/** Texto curto de um envio, para a dica da linha: "Enviado R$ 300,00 para o porquinho “Reserva” e mais 1". */
function sentText(sent: SentSummary): string {
  const first = sent.targets[0];
  const rest = sent.targets.length - 1;
  return `Enviado ${formatBRL(sent.total)} para ${SENT_KIND[first.kind]} “${first.name}”${rest > 0 ? ` e mais ${rest}` : ""}`;
}

/** Uma página do card: a barra e as fatias de uma distribuição, cada uma com Enviar e, depois de enviada, a seta de desfazer. */
function DistributionPage({ dist, items, sent, onSend, onUndo }: {
  dist: MonthDistribution;
  items: DistributionItem[];
  sent: Record<string, SentSummary>;
  onSend: (slice: DistributionItem, remaining: number) => void;
  onUndo: (slice: DistributionItem, done: SentSummary) => void;
}) {
  // categorias com 0% continuam cadastradas, mas não aparecem na apresentação
  const parts = useMemo(() => distributeBalance(dist.amount, items).filter((p) => p.item.percent > 0), [dist.amount, items]);

  if (dist.amount <= 0) {
    return (
      <div className="rounded-md bg-bad-bg px-3 py-2.5 text-[13px] font-semibold text-destructive">
        {dist.amount === 0 ? "Seu saldo está zerado. Não há o que distribuir." : "Seu saldo está negativo. Revise despesas variáveis antes de investir."}
      </div>
    );
  }

  const sentTotal = parts.reduce((sum, p) => sum + (sent[sentKey(dist.id, p.item.id)]?.total ?? 0), 0);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 break-words text-[13px]">
          <b>{dist.label}</b>
          <span className="text-muted-foreground"> · {dist.group === 1 ? "saldo do mês" : dist.incomes.map((i) => i.name).join(", ")}</span>
        </span>
        <b className="num flex-none text-[13px]">{formatBRL(dist.amount)}</b>
      </div>
      <div className="mb-1 flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <i key={p.item.id} className="block min-w-1" style={{ flex: p.item.percent, background: sliceColor(items, p.item.id) }} title={`${p.item.label}: ${formatBRL(p.value)}`} />
        ))}
      </div>
      {sentTotal > 0 && <p className="mb-1 text-[12px] text-success">{formatBRL(sentTotal)} de {formatBRL(dist.amount)} enviados</p>}
      {parts.map((p) => {
        const done = sent[sentKey(dist.id, p.item.id)];
        const remaining = Math.max(0, p.value - (done?.total ?? 0));
        const fraction = done ? Math.min(100, (done.total / p.value) * 100) : 0;
        return (
          <div
            key={p.item.id}
            title={done ? `${sentText(done)}${remaining > 0 ? `; falta ${formatBRL(remaining)}` : "; tudo enviado"}` : undefined}
            className="relative flex items-center gap-2 border-t border-border py-2 text-[13.5px] first:border-t-0"
          >
            <i className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: sliceColor(items, p.item.id) }} />
            <span className="min-w-0 flex-1 break-words">{p.item.label} <small className="text-muted-foreground">{p.item.percent}%</small></span>
            <b className="num flex-none">{formatBRL(p.value)}</b>
            {done && (
              <button
                type="button"
                onClick={() => onUndo(p.item, done)}
                aria-label={`Desfazer o envio de ${p.item.label}`}
                title="Desfazer o envio"
                className="grid h-7 w-7 flex-none place-items-center rounded-md border border-border-strong text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Icon name="restore" size={14} />
              </button>
            )}
            <button
              type="button"
              disabled={remaining <= 0}
              onClick={() => onSend(p.item, remaining)}
              aria-label={`Enviar ${p.item.label} para metas`}
              className="w-[74px] flex-none whitespace-nowrap rounded-md border border-border-strong px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              {done && remaining <= 0 ? "Enviado ✓" : "Enviar"}
            </button>
            {done && <i className="absolute bottom-0 left-0 block h-[2px] rounded-full bg-success" style={{ width: `${fraction}%` }} />}
          </div>
        );
      })}
    </>
  );
}

function Suggestion() {
  const month = useFinanceStore((s) => s.currentMonth);
  const dists = useMonthDistributions();
  const sent = useSentByDistribution();
  const setDistribution = useFinanceStore((s) => s.setDistribution);
  const setOverride = useFinanceStore((s) => s.setDistributionOverride);
  const undoSend = useFinanceStore((s) => s.undoDistributionSend);
  const globalItems = useFinanceStore((s) => s.distribution);
  const overrides = useFinanceStore((s) => s.distributionOverrides);
  const [selected, setSelected] = useState(1);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState<SendRequest | null>(null);
  const [undoing, setUndoing] = useState<UndoRequest | null>(null);

  // a página aberta some se a distribuição deixou de existir (ex.: a renda dela foi apagada)
  const dist = dists.find((d) => d.group === selected) ?? dists[0];
  const items = useDistributionItemsFor(dist.group);
  const base = globalItems ?? DEFAULT_DISTRIBUTION;
  const first = dist.group === 1;
  const hasOwn = !first && !!overrides[overrideKey(month, dist.group)];
  const canRestore = first ? globalItems !== null : hasOwn;
  const multiple = dists.length > 1;

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Opções da sugestão" className="grid h-10 w-10 place-items-center sm:h-8 sm:w-8 rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary">
          <Icon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Icon name="edit" size={15} />
          {first ? "Personalizar o padrão" : `Personalizar a ${dist.label}`}
        </DropdownMenuItem>
        {canRestore && (
          <DropdownMenuItem onSelect={() => (first ? setDistribution(null) : setOverride(month, dist.group, null))}>
            <Icon name="restore" size={15} />
            {first ? "Restaurar padrão" : "Voltar ao padrão"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <Panel tour="sugestao" title="Sugestão para o saldo" subtitle={!multiple && dist.amount > 0 ? `Como dividir ${formatBRLShort(dist.amount)}` : undefined} action={menu}>
        {multiple && (
          <div role="tablist" aria-label="Distribuições do mês" className="mb-3 flex flex-wrap gap-1.5">
            {dists.map((d) => (
              <button
                key={d.group}
                type="button"
                role="tab"
                aria-selected={d.group === dist.group}
                onClick={() => setSelected(d.group)}
                className="rounded-full border border-border-strong bg-card px-3 py-1 text-[12.5px] font-semibold text-ink2 transition-colors aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        {!first && (
          <p className="mb-2 text-[12px] text-muted-foreground">{hasOwn ? "Percentuais só desta distribuição, neste mês." : "Segue os percentuais padrão. Se você alterar, muda só esta distribuição, neste mês."}</p>
        )}
        <DistributionPage
          key={`${month}-${dist.group}`}
          dist={dist}
          items={items}
          sent={sent}
          onSend={(slice, remaining) => setSending({ month, sourceId: dist.id, sourceLabel: dist.label, slice, remaining })}
          onUndo={(slice, done) => setUndoing({ month, sourceId: dist.id, distLabel: dist.label, sliceId: slice.id, sliceLabel: slice.label, sent: done })}
        />
      </Panel>
      <DistributionDialog
        key={`${month}-${dist.group}`}
        open={editing}
        onClose={() => setEditing(false)}
        title={first ? "Personalizar o padrão da sugestão" : `Personalizar a ${dist.label}`}
        description={
          first
            ? "O padrão vale para a Dist 1 de todos os meses e é o ponto de partida das outras distribuições. As cinco categorias padrão ficam sempre, e a soma precisa ser 100%."
            : `Muda só a ${dist.label}, neste mês: as outras distribuições e os outros meses não mudam. A soma precisa ser 100%.`
        }
        current={items}
        base={base}
        onSave={(next) => {
          if (first) setDistribution(next);
          else setOverride(month, dist.group, next);
          showToast({ type: "success", text: first ? "Padrão da sugestão atualizado" : `${dist.label} atualizada` });
        }}
      />
      <SendDistributionDialog request={sending} onClose={() => setSending(null)} />
      <UndoSendDialog
        request={undoing}
        onClose={() => setUndoing(null)}
        onConfirm={(r) => {
          const removed = undoSend(r.month, r.sourceId, r.sliceId);
          showToast({ type: "success", text: removed > 0 ? `Envio desfeito: ${formatBRL(r.sent.total)} voltaram para “${r.sliceLabel}”` : "Nenhum envio para desfazer" });
          setUndoing(null);
        }}
      />
    </>
  );
}

function GoalsMini() {
  // porquinhos não têm porcentagem: este resumo mostra só as metas principais
  const allGoals = useFinanceStore((s) => s.goals);
  const realGoals = useMemo(() => allGoals.filter((g) => !g.piggy), [allGoals]);
  const openLaunch = useUiStore((s) => s.openLaunch);
  // durante o tour, quem não criou metas vê metas de exemplo (o tour não depende de dados do usuário)
  const demo = useUiStore((s) => s.tourDemo) && realGoals.length === 0;
  const goals = useMemo(() => (demo ? getDemoGoals() : realGoals), [demo, realGoals]);

  return (
    <Panel tour="metas" title="Metas" subtitle={demo ? "Exemplo ilustrativo" : "Progresso geral"}>
      {goals.length === 0 ? (
        <Empty>Você ainda não criou metas.</Empty>
      ) : (
        goals.slice(0, 4).map((g) => {
          const pct = goalPercent(g);
          return (
            <div key={g.id} className="mb-3">
              <div className="mb-1.5 flex justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate font-semibold">{g.name}</span>
                <b className="num">{pct}%</b>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-secondary">
                <i className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })
      )}
      {goals.length === 0 ? (
        <button type="button" onClick={() => openLaunch("goal")} className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Criar uma meta →</button>
      ) : (
        <Link to="/metas" className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ver todas as metas →</Link>
      )}
    </Panel>
  );
}

function RecentExpenses() {
  // compras avulsas no cartão ficam só na fatura, não nesta lista
  const expenses = useMonthTransactions().filter((t) => t.type === "expense" && !isCardPurchase(t));
  const credit = useMonthCredit();
  const month = useFinanceStore((s) => s.currentMonth);
  const extras = useResolvedExtras().filter((e) => e.month === month && !isCardPurchase(e));

  const lines: ExpenseLine[] = [
    ...[...expenses].reverse().map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, fixed: e.fixed })),
    ...credit.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      amount: c.installmentValue,
      installment: c.recurring ? undefined : `${c.currentInstallment}/${c.installments}`,
      recurring: c.recurring,
      advanced: !!c.advanced,
      progress: c.recurring ? undefined : { value: c.currentInstallment, max: c.installments },
    })),
    ...extras.map((e) => ({ id: e.id, name: e.name, category: "Outros", amount: e.amount })),
  ];

  return (
    <Panel tour="despesas" title="Despesas do mês" subtitle={`${lines.length} ${lines.length === 1 ? "lançamento" : "lançamentos"} · 5 mais recentes`}>
      {lines.length === 0 ? <Empty>Nenhuma despesa neste mês.</Empty> : lines.slice(0, 5).map((l) => <ExpenseStaticRow key={l.id} line={l} />)}
      <Link to="/lancamentos" className="mt-1 inline-flex min-h-10 items-center text-[13px] font-bold text-primary">Ver todos os lançamentos →</Link>
    </Panel>
  );
}

function NotesReadOnly() {
  const month = useFinanceStore((s) => s.currentMonth);
  const notes = useFinanceStore((s) => s.notes).filter((n) => n.month === month);
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <Panel tour="anotacoes" title="Anotações" subtitle="Lembretes do mês">
      {sorted.length === 0 ? (
        <Empty>Nenhuma anotação neste mês.</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.slice(0, 4).map((n) => (
            <div key={n.id} className={`flex flex-col gap-1 rounded-md border bg-secondary px-3.5 py-3 text-[13.5px] ${n.pinned ? "border-primary" : "border-border"}`}>
              {n.content}
              <small className="text-xs text-muted-foreground">{n.pinned ? "Fixada · " : ""}{n.date}</small>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function GoalDeadlines() {
  const { unseen: alerts, markSeen } = useGoalAlerts();
  if (alerts.length === 0) return null;
  const urgent = alerts.some((a) => a.level !== "soon");

  return (
    <section role="alert" data-tour="prazos" className={`mb-3.5 rounded-lg border px-5 py-4 ${urgent ? "border-destructive/50 bg-bad-bg" : "border-[hsl(var(--k3)/0.5)] bg-[hsl(var(--k3)/0.12)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <Icon name="bell" size={16} />
          {alerts.length === 1 ? "Uma meta com prazo chegando" : `${alerts.length} metas com prazo chegando`}
        </h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => markSeen(alerts)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline">
            <Icon name="check" size={14} />
            Marcar como visto
          </button>
          <Link to="/metas" className="text-[13px] font-bold text-primary">Ver metas →</Link>
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink2">
        {alerts.slice(0, 3).map((a) => (
          <li key={a.goal.id}>
            <b className="text-foreground">{a.goal.name}</b> · {deadlineStatus(a).toLowerCase()}. {paceHint(a)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dias de fôlego: quanto tempo a reserva sustenta a despesa média diária do mês. Só aparece se o usuário ligar e tiver reserva. */
function Breathing() {
  const show = usePrefsStore((s) => s.showBreathing);
  const goals = useFinanceStore((s) => s.goals);
  const investments = useFinanceStore((s) => s.investments);
  const month = useFinanceStore((s) => s.currentMonth);
  const { totalIncome, totalExpense } = useMonthSummary();
  const monthTransactions = useMonthTransactions();
  if (!show) return null;

  const reserve = reserveTotal(goals, investments);
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const result = breathingDays(reserve, totalExpense, days);
  if (result === null) return null;
  const fixed = monthTransactions.filter((t) => t.type === "expense" && t.fixed).reduce((sum, t) => sum + t.amount, 0);
  const free = freedomDay(totalIncome, fixed, days);

  return (
    <Panel title="Dias de fôlego" subtitle="Quanto tempo a sua reserva sustenta">
      <p className="font-display text-[28px] font-semibold leading-tight">{result} {result === 1 ? "dia" : "dias"}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Reserva de {formatBRL(reserve)} (metas com “reserva” ou “emergência” no nome e investimentos de liquidez diária) ÷ despesa média de {formatBRL(Math.round(totalExpense / days))} por dia.
      </p>
      {free !== null && <p className="mt-2 text-[13px] text-ink2">Dia da liberdade de gastos: a partir do dia <b>{free}</b> a renda do mês cobre as despesas fixas.</p>}
    </Panel>
  );
}

/** Painel: só leitura, com um atalho de escrita (enviar uma fatia da sugestão do saldo para metas, porquinhos e investimentos). Tudo o que se edita fica em Lançamentos. */
export default function Painel() {
  const month = useFinanceStore((s) => s.currentMonth);
  const [timeOpen, setTimeOpen] = useState(false);
  const showHours = usePrefsStore((s) => s.showHours);

  return (
    <>
      <PageHeader tour={PAINEL_TOUR} title="Painel" subtitle={`${formatMonthTitle(month)}. Aqui é só leitura (exceto enviar o saldo para as metas); cadastre pelo botão “Lançar”.`}
        action={
          <button type="button" data-tour="tempo" onClick={() => setTimeOpen(true)} aria-pressed={showHours} className={`${btnClass.base} ${btnClass.sm} ${showHours ? "!border-primary !text-primary" : ""}`}>
            <Icon name="clock" size={14} />
            Tempo e fôlego
          </button>
        }
      />
      <TimeSettings open={timeOpen} onClose={() => setTimeOpen(false)} />
      <GoalDeadlines />
      <div className="grid grid-cols-12 items-stretch gap-3.5 [&>div>*]:h-full">
        <div className="col-span-12 lg:col-span-4"><Hero /></div>
        <div className="col-span-12 lg:col-span-8"><Trend /></div>
        <div className="col-span-12 lg:col-span-4"><Categories /></div>
        <div className="col-span-12 lg:col-span-4"><Suggestion /></div>
        <div className="col-span-12 lg:col-span-4"><GoalsMini /></div>
        <div className="col-span-12 lg:col-span-8"><RecentExpenses /></div>
        <div className="col-span-12 lg:col-span-4"><NotesReadOnly /></div>
        <Breathing />
      </div>
    </>
  );
}
