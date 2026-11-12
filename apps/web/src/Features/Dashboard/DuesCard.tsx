import { useMemo, useState } from "react";
import Panel, { Empty, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { DUE_WINDOWS, dueLabel, formatPaymentDay, todayISO, type DueItem, type Payment } from "@/domain";
import { formatBRL } from "@/lib/money";
import { usePrefsStore } from "@/lib/preferences";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { useUpcomingDues } from "@/Store/dues";
import PaymentDialog, { type PaymentTarget } from "../Launch/PaymentDialog";
import { showToast } from "../Warnings/toast";

const tone = (d: DueItem) => (d.level === "overdue" ? "bad" : d.level === "today" || d.level === "soon" ? "warn" : "default");

/** Exemplos do tour (quando não há nenhum vencimento): fictícios, nunca gravados. */
function demoDues(): DueItem[] {
  const today = todayISO();
  const at = (days: number) => todayISO(new Date(Date.now() + days * 86_400_000));
  return [
    { key: "demo-1", kind: "expense", id: "demo-1", month: today.slice(0, 7), name: "Aluguel (exemplo)", amount: 120000, date: at(-2), days: -2, level: "overdue" },
    { key: "demo-2", kind: "invoice", id: "demo-2", month: today.slice(0, 7), name: "Fatura Cartão (exemplo)", amount: 85000, date: at(3), days: 3, level: "soon" },
    { key: "demo-3", kind: "expense", id: "demo-3", month: today.slice(0, 7), name: "Internet (exemplo)", amount: 12000, date: at(9), days: 9, level: "later" },
  ];
}

/**
 * Próximos vencimentos: o que ainda vai vencer (despesas com dia de vencimento e faturas de cartão não pagas), com os
 * atrasados primeiro. "Marcar como paga" é só um registro e some da lista. Não altera nenhum total do Painel.
 */
export default function DuesCard() {
  const dues = useUpcomingDues();
  const window = usePrefsStore((s) => s.dueWindow);
  const setTransactionPayment = useFinanceStore((s) => s.setTransactionPayment);
  const setCardPayment = useFinanceStore((s) => s.setCardPayment);
  const demo = useUiStore((s) => s.tourDemo) && dues.length === 0;
  const shown = useMemo(() => (demo ? demoDues() : dues), [demo, dues]);
  const [paying, setPaying] = useState<{ item: DueItem; target: PaymentTarget } | null>(null);

  function confirm(payment: Payment) {
    if (!paying) return;
    const { item } = paying;
    if (item.kind === "invoice") setCardPayment(item.id, item.month, payment);
    else setTransactionPayment(item.id, item.month, payment);
    showToast({ type: "success", text: `"${item.name}" marcada como paga` });
    setPaying(null);
  }

  return (
    <>
      <Panel
        tour="vencimentos"
        title="Próximos vencimentos"
        subtitle={demo ? "Exemplo ilustrativo" : `O que ainda não foi pago, nos próximos ${window} dias`}
        action={
          <select
            aria-label="Janela dos próximos vencimentos"
            value={window}
            onChange={(e) => usePrefsStore.getState().setPrefs({ dueWindow: Number(e.target.value) })}
            className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12.5px] font-semibold text-ink2"
          >
            {DUE_WINDOWS.map((w) => <option key={w} value={w}>{w} dias</option>)}
          </select>
        }
      >
        {shown.length === 0 ? (
          <>
            <Empty>Nada vencendo nos próximos dias.</Empty>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Informe o “Dia do vencimento” ao lançar uma despesa para ela aparecer aqui. As faturas de cartão aparecem sozinhas, no vencimento.</p>
          </>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((d) => (
              <li key={d.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="block min-w-0 break-words text-[13.5px] font-semibold">{d.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                    {formatPaymentDay(d.date)}
                    <Pill tone={tone(d)}>{dueLabel(d.days)}</Pill>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <b className="num text-[14px]">{formatBRL(d.amount)}</b>
                  <button
                    type="button"
                    disabled={demo}
                    onClick={() => setPaying({ item: d, target: { name: d.name, amount: d.amount } })}
                    className={`${btnClass.base} ${btnClass.sm}`}
                  >
                    Marcar como paga
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <PaymentDialog target={paying?.target ?? null} onConfirm={confirm} onClose={() => setPaying(null)} />
    </>
  );
}
