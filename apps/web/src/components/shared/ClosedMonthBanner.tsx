import { useState } from "react";
import ReopenMonthDialog from "@/components/shared/ReopenMonthDialog";
import { formatPaymentDate } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { formatMonthTitle } from "@/Utils/Date";

/** Faixa em qualquer tela quando o mês visto está fechado: mostra o retrato e deixa reabrir (com confirmação). */
export default function ClosedMonthBanner() {
  const month = useFinanceStore((s) => s.currentMonth);
  const closing = useFinanceStore((s) => s.closings[month]);
  const reopen = useFinanceStore((s) => s.reopenMonth);
  const [asking, setAsking] = useState(false);
  if (!closing) return null;
  return (
    <>
      <p role="status" className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-border-strong bg-secondary px-3.5 py-2 text-[13px] text-ink2">
        <span>
          <b className="text-foreground">{formatMonthTitle(month)} está fechado</b> desde {formatPaymentDate(closing.closedAt)}: saldo de {formatBRL(closing.balance)}.
          {closing.note && <> Anotação: “{closing.note}”</>}
        </span>
        <button type="button" onClick={() => setAsking(true)} className="font-bold text-primary hover:underline">Reabrir mês</button>
      </p>
      <ReopenMonthDialog open={asking} month={month} onConfirm={() => { reopen(month); setAsking(false); }} onCancel={() => setAsking(false)} />
    </>
  );
}
