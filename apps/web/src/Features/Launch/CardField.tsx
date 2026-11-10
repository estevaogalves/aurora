import { Field, inputClass } from "@/components/shared/FormFields";
import { dayMonth, getInvoice } from "@/domain";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { formatMonthTitle } from "@/Utils/Date";

interface CardProps {
  cardId: string;
  onChange: (id: string) => void;
  /** data da cobrança ("AAAA-MM-DD"): com ela e o cartão, mostra em qual fatura entra */
  date: string;
  onNavigate?: () => void;
}

/** Atalho para cadastrar: a aba Cartão do próprio Lançar. */
function RegisterCardLink({ onNavigate }: { onNavigate?: () => void }) {
  const openLaunch = useUiStore((s) => s.openLaunch);
  return (
    <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => { onNavigate?.(); openLaunch("card"); }}>
      Cadastrar cartão
    </button>
  );
}

/** Select do cartão. Sem cartões cadastrados, mostra um aviso curto com o atalho para cadastrar. */
export function CardSelect({ cardId, onChange, onNavigate }: Omit<CardProps, "date">) {
  const cards = useFinanceStore((s) => s.creditCards);

  if (cards.length === 0) {
    return (
      <Field label="Cartão" htmlFor="launch-card" hint="(opcional)">
        <div className="flex min-h-11 items-center rounded-md border border-dashed border-border px-3 text-[13px] text-muted-foreground">
          <span>Nenhum cartão. <RegisterCardLink onNavigate={onNavigate} /></span>
        </div>
      </Field>
    );
  }

  return (
    <Field label="Cartão" htmlFor="launch-card" hint="(opcional)">
      <select id="launch-card" value={cardId} onChange={(e) => onChange(e.target.value)} className={`${inputClass} min-h-11`}>
        <option value="">Sem cartão</option>
        {cards.map((k) => (
          <option key={k.id} value={k.id}>{k.name} · fecha {k.closingDay}, vence {k.dueDay}</option>
        ))}
      </select>
    </Field>
  );
}

/** "Entra na fatura que fecha em DD/MM e vence em DD/MM, e será contabilizada em <mês>". Só leitura. */
export function InvoiceInfo({ cardId, date }: Pick<CardProps, "cardId" | "date">) {
  const cards = useFinanceStore((s) => s.creditCards);
  const card = cards.find((k) => k.id === cardId);
  const invoice = card && /^\d{4}-\d{2}-\d{2}$/.test(date) ? getInvoice(card, date) : null;
  if (!invoice) return null;
  return (
    <p data-testid="invoice-info" className="rounded-md bg-secondary px-3 py-2 text-[12.5px] text-muted-foreground">
      Entra na fatura que fecha em <strong className="text-foreground">{dayMonth(invoice.closingDate)}</strong> e vence em{" "}
      <strong className="text-foreground">{dayMonth(invoice.dueDate)}</strong>, e será contabilizada em{" "}
      <strong className="text-foreground">{formatMonthTitle(invoice.month)}</strong>.
    </p>
  );
}

/** Cartão + informativo da fatura, um sobre o outro (usado na edição da compra). */
export default function CardField(props: CardProps) {
  return (
    <div className="flex flex-col gap-2">
      <CardSelect {...props} />
      <InvoiceInfo cardId={props.cardId} date={props.date} />
    </div>
  );
}
