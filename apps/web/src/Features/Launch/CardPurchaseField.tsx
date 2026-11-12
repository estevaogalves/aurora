import { Field, inputClass } from "@/components/shared/FormFields";
import { useFinanceStore } from "@/Store/FinanceStore";
import { CardSelect, InvoiceInfo } from "./CardField";

interface Props {
  cardId: string;
  onCardChange: (id: string) => void;
  /** dia da compra ("AAAA-MM-DD") */
  date: string;
  onDateChange: (date: string) => void;
  onNavigate?: () => void;
  /** prefixo dos ids, para o rótulo do campo de data */
  idPrefix: string;
}

/**
 * Cartão (opcional) de uma despesa avulsa. Com cartão escolhido, pede o dia da compra e mostra em qual fatura ela
 * entra: o valor passa a valer no mês do vencimento dessa fatura, e o pagamento é marcado na fatura (em Lançamentos).
 */
export default function CardPurchaseField({ cardId, onCardChange, date, onDateChange, onNavigate, idPrefix }: Props) {
  const hasCards = useFinanceStore((s) => s.creditCards.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <CardSelect cardId={cardId} onChange={onCardChange} onNavigate={onNavigate} />
      {cardId && hasCards && (
        <>
          <Field label="Data da compra" htmlFor={`${idPrefix}-purchase-date`}>
            <input id={`${idPrefix}-purchase-date`} type="date" required value={date} onChange={(e) => onDateChange(e.target.value)} className={`${inputClass} block min-h-11 min-w-0 max-w-full appearance-none`} />
          </Field>
          <InvoiceInfo cardId={cardId} date={date} />
        </>
      )}
    </div>
  );
}
