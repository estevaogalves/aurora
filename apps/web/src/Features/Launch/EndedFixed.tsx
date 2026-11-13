import Icon from "@/components/Icon";
import { btnClass } from "@/components/shared/styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/money";
import { useFinanceStore, type Transaction } from "@/Store/FinanceStore";
import { useEndedTransactions } from "@/Store/selectors";
import { changeMonth, formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";
import CollapsibleSection from "./CollapsibleSection";

/**
 * Encerra uma despesa ou renda fixa a partir do mês visto: ela deixa de valer daqui em diante. Os meses anteriores,
 * os valores e os pagamentos já registrados não mudam. É diferente de "Ocultar neste mês", que esconde só um mês.
 */
export function EndFixedDialog({ transaction, month, onClose }: { transaction: Transaction | null; month: string; onClose: () => void }) {
  const end = useFinanceStore((s) => s.endTransactionFromMonth);
  const income = transaction?.type === "income";
  const noun = income ? "renda" : "despesa";

  function confirm() {
    if (!transaction) return;
    const error = end(transaction.id, month);
    if (error) showToast({ type: "error", text: error });
    else showToast({ type: "success", text: `"${transaction.name}" encerrada a partir de ${formatMonthTitle(month)}` });
    onClose();
  }

  return (
    <Dialog open={!!transaction} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar a partir de {formatMonthTitle(month)}?</DialogTitle>
          <DialogDescription className="break-words">
            {transaction
              ? `A ${noun} fixa "${transaction.name}" deixa de valer a partir de ${formatMonthTitle(month)}, inclusive. ${formatMonthTitle(changeMonth(month, -1))} e os meses anteriores ficam como estão, com os valores e os pagamentos já registrados. Dá para reativar depois, na lista "Encerradas".`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={confirm}>Encerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Fixas encerradas que já não valem neste mês, com o botão de reativar. */
export function EndedList({ kind }: { kind: "income" | "expense" }) {
  const resume = useFinanceStore((s) => s.resumeTransaction);
  const month = useFinanceStore((s) => s.currentMonth);
  const ended = useEndedTransactions().filter((t) => t.type === kind);
  if (ended.length === 0) return null;

  return (
    <CollapsibleSection id={`${kind}-ended`} title="Encerradas" count={ended.length}>
      {ended.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px] opacity-80">
          <span className="min-w-0 break-words">
            {t.name} · {formatBRL(t.amount)}
            <span className="block text-[12px] text-muted-foreground">Valeu até {formatMonthTitle(t.endMonth as string)}</span>
          </span>
          <button
            type="button"
            title={`Volta a valer a partir de ${formatMonthTitle(month)}; os meses entre o fim e este continuam desativados`}
            onClick={() => {
              resume(t.id, month);
              const skipped = changeMonth(t.endMonth as string, 1) !== month;
              showToast({ type: "success", text: `"${t.name}" reativada a partir de ${formatMonthTitle(month)}${skipped ? `; os meses de ${formatMonthTitle(changeMonth(t.endMonth as string, 1))} até ${formatMonthTitle(changeMonth(month, -1))} continuam desativados` : ""}` });
            }}
            className={`${btnClass.base} ${btnClass.sm}`}
          >
            <Icon name="restore" size={14} />
            Reativar a partir daqui
          </button>
        </div>
      ))}
    </CollapsibleSection>
  );
}
