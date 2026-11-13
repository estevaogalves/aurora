import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildClosing, compareWithPrevious, distributeBalance, getClosingPending, getMonthSummary, todayISO } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useDistributionItems, useTransactions } from "@/Store/selectors";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

const STEPS = ["Resumo", "Pendências", "Distribuição", "Comparação", "Anotação"] as const;

const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatBRL(Math.abs(cents))}`;

/**
 * Fechar o mês, em 5 passos: resumo, pendências (não pagos), distribuição do saldo, comparação com o mês anterior e uma
 * anotação de aprendizado. Fechar não apaga nem altera nenhum lançamento: só marca o mês e guarda um retrato dele.
 */
export default function CloseMonthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const month = useFinanceStore((s) => s.currentMonth);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Fechar {formatMonthTitle(month)}</DialogTitle>
          <DialogDescription>Um passo a passo para encerrar o mês. Nada é apagado ou alterado: o mês fica marcado como fechado e guarda um retrato.</DialogDescription>
        </DialogHeader>
        {open && <Steps key={month} month={month} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Steps({ month, onClose }: { month: string; onClose: () => void }) {
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const closeMonth = useFinanceStore((s) => s.closeMonth);
  const items = useDistributionItems();
  const data = useMemo(() => ({ transactions, creditTransactions, creditCards, extraExpenses }), [transactions, creditTransactions, creditCards, extraExpenses]);
  const summary = useMemo(() => getMonthSummary(data, month), [data, month]);
  const pending = useMemo(() => getClosingPending(data, month), [data, month]);
  const comparison = useMemo(() => compareWithPrevious(data, month), [data, month]);
  const slices = useMemo(() => distributeBalance(summary.balance, items).filter((p) => p.item.percent > 0), [summary.balance, items]);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");

  function confirm() {
    closeMonth(month, buildClosing(data, month, todayISO(), note));
    showToast({ type: "success", text: `${formatMonthTitle(month)} fechado` });
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-1.5 text-[12px] font-semibold" aria-label="Passos">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={`rounded-full px-2.5 py-1 ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-secondary text-ink2" : "border border-border text-muted-foreground"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-2 text-[13.5px]">
          {[["Renda", summary.totalIncome], ["Despesas", summary.totalExpense], ["Saldo", summary.balance]].map(([label, value]) => (
            <div key={label as string} className="flex justify-between gap-3 rounded-md bg-secondary px-3 py-2.5">
              <span className="text-muted-foreground">{label}</span>
              <b className={`num ${label === "Saldo" && (value as number) < 0 ? "text-destructive" : ""}`}>{formatBRL(value as number)}</b>
            </div>
          ))}
          <p className="text-[12.5px] text-muted-foreground">{Math.round(summary.expensePercentage)}% da renda comprometida.</p>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-2 text-[13.5px]">
          {pending.length === 0 ? (
            <p className="rounded-md bg-secondary px-3 py-2.5 text-ink2">Nada pendente: tudo o que tem valor neste mês já foi marcado como pago.</p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">Ainda não marcados como pagos (é só um registro; você pode fechar assim mesmo):</p>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border px-3">
                {pending.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 break-words">{p.name}{p.kind === "extra" && <span className="text-muted-foreground"> · extra</span>}</span>
                    <b className="num">{formatBRL(p.amount)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-2 text-[13.5px]">
          {summary.balance <= 0 ? (
            <p className="rounded-md bg-secondary px-3 py-2.5 text-ink2">{summary.balance === 0 ? "O saldo está zerado: não há o que distribuir." : "O saldo está negativo: revise as despesas variáveis."}</p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">Como a sugestão divide o saldo de {formatBRL(summary.balance)}. Para mandar uma fatia a uma meta, porquinho ou investimento, use o botão Enviar no card “Sugestão para o saldo” do Painel (depois do fechamento ou antes).</p>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border px-3">
                {slices.map((p) => (
                  <li key={p.item.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span>{p.item.label} <span className="text-[12px] text-muted-foreground">{p.item.percent}%</span></span>
                    <b className="num">{formatBRL(p.value)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-2 text-[13.5px]">
          {!comparison.hadData ? (
            <p className="rounded-md bg-secondary px-3 py-2.5 text-ink2">{formatMonthTitle(comparison.previous)} não teve movimento: não há com o que comparar.</p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">Contra {formatMonthTitle(comparison.previous)}:</p>
              {[["Renda", comparison.incomeDelta], ["Despesas", comparison.expenseDelta], ["Saldo", comparison.balanceDelta]].map(([label, delta]) => (
                <div key={label as string} className="flex justify-between gap-3 rounded-md bg-secondary px-3 py-2.5">
                  <span className="text-muted-foreground">{label}</span>
                  <b className="num">{signed(delta as number)}</b>
                </div>
              ))}
              {comparison.categories.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1 text-[12.5px] text-ink2">
                  {comparison.categories.map((c) => <li key={c.category}>{c.category}: de {formatBRL(c.from)} para {formatBRL(c.to)}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-2">
          <label htmlFor="close-note" className="text-[12.5px] font-bold text-ink2">O que você aprendeu neste mês? <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex.: gastei mais com mercado; no próximo mês vou planejar a lista." className="min-h-[88px] rounded-md border-border-strong bg-secondary" />
          <p className="text-xs text-muted-foreground">Não escreva números de cartão, senhas ou documentos.</p>
        </div>
      )}

      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={step === 0 ? onClose : () => setStep(step - 1)}>{step === 0 ? "Cancelar" : "Voltar"}</Button>
        {step < STEPS.length - 1 ? <Button type="button" onClick={() => setStep(step + 1)}>Próximo</Button> : <Button type="button" onClick={confirm}>Fechar o mês</Button>}
      </div>
    </div>
  );
}
