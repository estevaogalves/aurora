import { useState } from "react";
import CategorySelect from "@/components/shared/CategorySelect";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseBRL, splitInstallments } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore, type LaunchTab } from "@/Store/UiStore";
import type { Category } from "@/Types/Category";
import { changeMonth, formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

const tabClass =
  "whitespace-nowrap rounded-[10px] px-2 py-2 text-[12.5px] font-semibold text-ink2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow";

/**
 * Ação única de lançamento: despesa, renda, compra parcelada ou despesa extra.
 * O modal fica aberto depois de cada lançamento para cadastrar vários em sequência;
 * fecha com Esc, no X ou clicando fora.
 */
export default function TransactionForm() {
  const open = useUiStore((s) => s.launchOpen);
  const tab = useUiStore((s) => s.launchTab);
  const openLaunch = useUiStore((s) => s.openLaunch);
  const closeLaunch = useUiStore((s) => s.closeLaunch);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openLaunch() : closeLaunch())}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Um só formulário para renda, despesa, compra parcelada e despesa extra. A janela continua aberta para você lançar em sequência.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => openLaunch(v as LaunchTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md bg-secondary p-1 sm:grid-cols-4">
            <TabsTrigger value="expense" className={tabClass}>Despesa</TabsTrigger>
            <TabsTrigger value="income" className={tabClass}>Renda</TabsTrigger>
            <TabsTrigger value="credit" className={tabClass}>Crédito parcelado</TabsTrigger>
            <TabsTrigger value="extra" className={tabClass}>Despesa extra</TabsTrigger>
          </TabsList>
        </Tabs>

        {open && <LaunchFields key={tab} kind={tab} onClose={closeLaunch} />}
      </DialogContent>
    </Dialog>
  );
}

const LABELS = {
  expense: { name: "Nome da despesa", placeholder: "Ex.: Aluguel, internet...", amount: "Valor deste mês" },
  income: { name: "Nome da renda", placeholder: "Ex.: Salário, freelance...", amount: "Valor deste mês" },
  credit: { name: "Nome da compra", placeholder: "Ex.: Notebook", amount: "Valor total da compra" },
  extra: { name: "Descrição", placeholder: "Ex.: Seguro do carro", amount: "Valor" },
} as const;

function LaunchFields({ kind, onClose }: { kind: LaunchTab; onClose: () => void }) {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCreditTransaction = useFinanceStore((s) => s.addCreditTransaction);
  const addExtraExpense = useFinanceStore((s) => s.addExtraExpense);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Moradia");
  const [fixed, setFixed] = useState(false);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState(2);
  const [extraMonth, setExtraMonth] = useState(changeMonth(currentMonth, 1));
  // muda a cada lançamento: reinicia o foco e o campo de nome sem fechar o modal
  const [round, setRound] = useState(0);

  const totalCents = parseBRL(amount) ?? 0;
  const installmentValue = kind === "credit" && installments > 0 ? splitInstallments(totalCents, installments)[0] : 0;

  function reset() {
    setName("");
    setAmount("");
    setNotes("");
    setFixed(false);
    setInstallments(2);
    setRound((r) => r + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) return showToast({ type: "error", text: "Preencha o nome" });

    const cents = parseBRL(amount);
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });

    if (kind === "credit") {
      addCreditTransaction({
        id: crypto.randomUUID(),
        name: trimmed,
        totalAmount: cents,
        installments: Math.min(60, Math.max(1, Math.floor(installments) || 1)),
        startMonth: currentMonth,
        category,
      });
      showToast({ type: "success", text: `Compra parcelada "${trimmed}" adicionada` });
    } else if (kind === "income") {
      addTransaction({ id: crypto.randomUUID(), name: trimmed, amount: cents, type: "income", category: "Renda", fixed, month: currentMonth });
      showToast({ type: "success", text: `Renda "${trimmed}" adicionada` });
    } else if (kind === "extra") {
      if (!extraMonth) return showToast({ type: "error", text: "Escolha o mês da despesa extra" });
      addExtraExpense({ id: crypto.randomUUID(), name: trimmed, amount: cents, month: extraMonth });
      showToast({ type: "success", text: `Despesa extra "${trimmed}" adicionada` });
    } else {
      addTransaction({ id: crypto.randomUUID(), name: trimmed, amount: cents, type: "expense", category, notes: notes.trim(), fixed, month: currentMonth });
      showToast({ type: "success", text: `Despesa "${trimmed}" adicionada` });
    }

    reset();
  }

  const labels = LABELS[kind];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={labels.name} htmlFor="launch-name">
        <input
          key={round}
          id="launch-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.placeholder}
          className={inputClass}
        />
      </Field>

      <div className={kind === "credit" ? "grid gap-4 sm:grid-cols-2" : ""}>
        <Field label={labels.amount} htmlFor="launch-amount">
          <MoneyInput id="launch-amount" value={amount} onChange={setAmount} />
        </Field>

        {kind === "credit" && (
          <Field label="Parcelas" htmlFor="launch-installments">
            <input id="launch-installments" type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={inputClass} />
          </Field>
        )}
      </div>

      {kind === "credit" && (
        <p className="text-sm text-muted-foreground">
          Parcela de <strong className="text-foreground">R$ {centsToInput(installmentValue) || "0,00"}</strong>, começando em {formatMonthTitle(currentMonth)}.
        </p>
      )}

      {kind === "extra" && (
        <Field label="Mês da despesa" htmlFor="launch-extra-month" hint="(aparece na Projeção)">
          <input id="launch-extra-month" type="month" value={extraMonth} min={changeMonth(currentMonth, 1)} onChange={(e) => setExtraMonth(e.target.value)} className={inputClass} />
        </Field>
      )}

      {(kind === "expense" || kind === "credit") && (
        <Field label="Categoria" htmlFor="launch-category">
          <CategorySelect id="launch-category" value={category} onChange={setCategory} />
        </Field>
      )}

      {kind === "expense" && (
        <Field label="Observação" hint="(opcional)" htmlFor="launch-notes">
          <Textarea id="launch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações sobre esta despesa..." className="min-h-[64px] rounded-md border-border-strong bg-secondary" />
        </Field>
      )}

      {(kind === "expense" || kind === "income") && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <Checkbox checked={fixed} onCheckedChange={(c) => setFixed(Boolean(c))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">{kind === "income" ? "Renda fixa" : "Despesa fixa"}</span>
            <span className="block text-xs text-muted-foreground">Repete todo mês a partir deste. Dá para ajustar o valor de cada mês depois.</span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
        <Button type="submit">Adicionar</Button>
      </div>
    </form>
  );
}
