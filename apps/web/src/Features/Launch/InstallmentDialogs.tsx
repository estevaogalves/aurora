import { useState } from "react";
import { Field, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { advancedAmount, getInstallmentMonth, getInstallmentValue, patchCancelRecurrence, validateDiscount } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore, type CreditTransaction } from "@/Store/FinanceStore";
import { formatMonthTitle, getCurrentMonth } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

function Shell({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type InstallmentScope = "one" | "all";

/** Pergunta se a edição ou exclusão vale só para a parcela do mês ou para todas as parcelas da compra. */
export function ScopeDialog(props: ScopeDialogProps) {
  return (
    <Shell open={props.open} title={props.title} description={`Compra: ${props.name}.`} onClose={props.onClose}>
      {props.open && <ScopeChoice {...props} />}
    </Shell>
  );
}

interface ScopeDialogProps {
  open: boolean;
  title: string;
  name: string;
  /** ex.: "Parcela 2/3 · Dezembro de 2026" */
  installmentLabel: string;
  allNote: string;
  confirmLabel: string;
  destructive?: boolean;
  onChoose: (scope: InstallmentScope) => void;
  onClose: () => void;
}

/** A escolha começa sempre em "somente esta parcela" (o estado nasce junto com o conteúdo do diálogo). */
function ScopeChoice({ installmentLabel, allNote, confirmLabel, destructive, onChoose, onClose }: ScopeDialogProps) {
  const [scope, setScope] = useState<InstallmentScope>("one");
  const options: [InstallmentScope, string, string][] = [
    ["one", "Somente esta parcela", installmentLabel],
    ["all", "Todas as parcelas da compra", allNote],
  ];

  return (
    <>
      <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-secondary p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Vale para</legend>
        {options.map(([value, text, hint]) => (
          <label key={value} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name="installment-scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
            <span>
              <span className="block font-semibold">{text}</span>
              <span className="block text-[12.5px] text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" variant={destructive ? "destructive" : "default"} onClick={() => onChoose(scope)}>{confirmLabel}</Button>
      </div>
    </>
  );
}

/** Confirma o cancelamento de uma compra recorrente: os meses até `last` ficam, os seguintes deixam de ser cobrados. */
export function CancelRecurrenceDialog({ credit, month, onClose }: { credit: CreditTransaction | null; month: string; onClose: () => void }) {
  const cancel = useFinanceStore((s) => s.cancelCreditRecurrence);
  const result = credit ? patchCancelRecurrence(credit, month, getCurrentMonth()) : null;
  const last = result?.ok ? result.patch.endMonth : undefined;

  function confirm() {
    if (!credit) return;
    const error = cancel(credit.id, month);
    if (error) return showToast({ type: "error", text: error });
    showToast({ type: "success", text: `Recorrência de "${credit.name}" cancelada` });
    onClose();
  }

  return (
    <Shell
      open={!!credit}
      title="Cancelar recorrência"
      description={credit ? `Compra: ${credit.name} · ${formatBRL(credit.totalAmount)} por mês.` : ""}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {last
          ? `A última cobrança será em ${formatMonthTitle(last)}. Os meses até lá continuam como estão; a partir do mês seguinte, nada mais é cobrado.`
          : "Não foi possível calcular o último mês cobrado."}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Voltar</Button>
        <Button type="button" variant="destructive" disabled={!last} onClick={confirm}>Cancelar recorrência</Button>
      </div>
    </Shell>
  );
}

/** Muda só o valor de uma parcela. */
export function EditInstallmentDialog({ credit, n, onClose }: { credit: CreditTransaction | null; n: number; onClose: () => void }) {
  return (
    <Shell
      open={!!credit}
      title="Editar esta parcela"
      description={credit ? `${credit.name} · parcela ${n}/${credit.installments} (${formatMonthTitle(getInstallmentMonth(credit, n))}). As outras parcelas não mudam.` : ""}
      onClose={onClose}
    >
      {credit && <InstallmentValueFields key={`${credit.id}-${n}`} credit={credit} n={n} onClose={onClose} />}
    </Shell>
  );
}

function InstallmentValueFields({ credit, n, onClose }: { credit: CreditTransaction; n: number; onClose: () => void }) {
  const update = useFinanceStore((s) => s.updateCreditInstallment);
  const [value, setValue] = useState(centsToInput(getInstallmentValue(credit, n)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(value);
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });
    const error = update(credit.id, n, cents);
    if (error) return showToast({ type: "error", text: error });
    showToast({ type: "success", text: "Parcela atualizada" });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Valor da parcela" htmlFor="edit-installment-value">
        <MoneyInput id="edit-installment-value" value={value} onChange={setValue} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}

/** Confirma o adiantamento: valor da parcela (só leitura), desconto do banco e o valor adiantado. */
export function AdvanceDialog({ credit, n, onClose }: { credit: CreditTransaction | null; n: number; onClose: () => void }) {
  return (
    <Shell
      open={!!credit}
      title="Adiantar parcela"
      description={credit ? `${credit.name} · parcela ${n}/${credit.installments}, que cai em ${formatMonthTitle(getInstallmentMonth(credit, n))}.` : ""}
      onClose={onClose}
    >
      {credit && <AdvanceFields key={`${credit.id}-${n}`} credit={credit} n={n} onClose={onClose} />}
    </Shell>
  );
}

function AdvanceFields({ credit, n, onClose }: { credit: CreditTransaction; n: number; onClose: () => void }) {
  const advance = useFinanceStore((s) => s.advanceCreditInstallment);
  const value = getInstallmentValue(credit, n);
  const [discount, setDiscount] = useState("");

  // campo vazio vale zero (sem desconto); texto que não é número é inválido
  const cents = discount.trim() === "" ? 0 : parseBRL(discount);
  const error = cents === null ? "Informe um desconto válido." : validateDiscount(value, cents);
  const today = getCurrentMonth();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cents === null || error) return showToast({ type: "error", text: error ?? "Informe um desconto válido." });
    const failure = advance(credit.id, n, cents);
    if (failure) return showToast({ type: "error", text: failure });
    showToast({ type: "success", text: `Parcela adiantada: ${formatBRL(advancedAmount(value, cents))} em ${formatMonthTitle(today)}` });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Valor da parcela" htmlFor="advance-value">
        <MoneyInput id="advance-value" value={centsToInput(value)} disabled />
      </Field>
      <Field label="Desconto oferecido pelo banco" htmlFor="advance-discount">
        <MoneyInput id="advance-discount" value={discount} onChange={setDiscount} />
      </Field>
      <div className="rounded-md bg-secondary px-3.5 py-3 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">Valor adiantado</span>
          <span className="num text-base font-bold" data-testid="advance-amount">{error ? "—" : formatBRL(advancedAmount(value, cents ?? 0))}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Será somado a {formatMonthTitle(today)} e deixa de ser cobrado em {formatMonthTitle(getInstallmentMonth(credit, n))}. Depois de adiantada, não dá para desfazer.
        </p>
        {error && <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={!!error}>Confirmar adiantamento</Button>
      </div>
    </form>
  );
}
