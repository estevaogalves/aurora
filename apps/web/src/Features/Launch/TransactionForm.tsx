import MonthPicker from "@/components/shared/MonthPicker";
import { useEffect, useState } from "react";
import TourHelpButton from "@/components/tour/TourHelpButton";
import { btnClass } from "@/components/shared/styles";
import CategorySelect from "@/components/shared/CategorySelect";
import { Field, FREE_TEXT_WARNING, inputClass, MoneyInput } from "@/components/shared/FormFields";
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
import Icon from "@/components/Icon";
import Calculator, { CALCULATOR_ATTR } from "../Calculator/Calculator";
import { showToast } from "../Warnings/toast";

const tabClass =
  "min-h-10 whitespace-nowrap rounded-[10px] px-0.5 py-2 text-[12px] font-semibold sm:px-1.5 sm:text-[12.5px] text-ink2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow";

const LAUNCH_TABS: LaunchTab[] = ["expense", "income", "credit", "extra", "goal"];

/** Mini tour do modal: o que cada aba representa. */
const TAB_HELP: Record<LaunchTab, { title: string; text: string }> = {
  expense: { title: "Despesa", text: "Um gasto do mês, como aluguel, mercado ou internet. Marque “Despesa fixa” para repetir todo mês; sem marcar, vale só neste mês." },
  income: { title: "Renda", text: "Dinheiro que entra, como salário ou freelance. A renda fixa repete todo mês; a variável vale só no mês em que foi lançada." },
  credit: { title: "Crédito parcelado", text: "Compra no cartão em várias vezes. Informe o valor total e o número de parcelas: o app divide e lança uma parcela por mês, a partir deste. Marque “Compra recorrente” para uma assinatura: um valor único, cobrado todo mês até você cancelar." },
  extra: { title: "Despesa extra", text: "Gasto que não se repete todo mês e que você quer planejar, como IPVA ou uma viagem. Escolha o mês futuro; ela aparece na aba Projeção." },
  goal: { title: "Meta", text: "Um objetivo para juntar dinheiro, como a reserva de emergência. Informe o valor, o aporte mensal e o prazo (opcionais) e acompanhe na aba Metas. Marque “Porquinho” para guardar sem valor de meta: só nome, já guardado, aporte e prazo; ele fica abaixo das metas principais." },
};

/** Chave em que se grava a resposta ao mini tour do modal. */
const LAUNCH_TOUR_KEY = "lancar";

/**
 * Ação única de lançamento: despesa, renda, compra parcelada ou despesa extra.
 * O modal fica aberto depois de cada lançamento para cadastrar vários em sequência;
 * fecha com Esc, no X ou clicando fora.
 * No primeiro uso oferece um mini tour das abas (o usuário aceita ou não); o botão ? inicia ou refaz.
 */
export default function TransactionForm() {
  const open = useUiStore((s) => s.launchOpen);
  const tab = useUiStore((s) => s.launchTab);
  const openLaunch = useUiStore((s) => s.openLaunch);
  const closeLaunch = useUiStore((s) => s.closeLaunch);
  const calcOpen = useUiStore((s) => s.calcOpen);
  const toggleCalc = useUiStore((s) => s.toggleCalc);
  const closeCalc = useUiStore((s) => s.closeCalc);
  const hydrated = useFinanceStore((s) => s.hydrated);
  const answered = useFinanceStore((s) => s.onboarding[LAUNCH_TOUR_KEY]);
  const setOnboarding = useFinanceStore((s) => s.setOnboarding);
  const [help, setHelp] = useState<number | null>(null);

  function startHelp() {
    setHelp(0);
    openLaunch(LAUNCH_TABS[0]);
  }

  function goTo(i: number) {
    setHelp(i);
    openLaunch(LAUNCH_TABS[i]);
  }

  function endHelp(state: "done" | "dismissed") {
    setHelp(null);
    setOnboarding(LAUNCH_TOUR_KEY, state);
  }

  // primeira vez que o modal abre: só oferece o mini tour, sem iniciar
  const invite = open && hydrated && !answered && help === null;

  // setas navegam o mini tour (fora dos campos de texto)
  useEffect(() => {
    if (help === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      // só os campos com texto ficam com as setas (mover o cursor); vazios e botões deixam navegar
      const el = e.target as HTMLElement | null;
      if (el?.matches("input, textarea, select, [contenteditable='true']") && (el as HTMLInputElement).value !== "") return;
      e.preventDefault();
      e.stopPropagation();
      const to = help + (e.key === "ArrowRight" ? 1 : -1);
      if (to < 0) return;
      if (to >= LAUNCH_TABS.length) endHelp("done");
      else goTo(to);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [help]);

  function onOpenChange(next: boolean) {
    if (next) return openLaunch();
    if (help !== null) endHelp("dismissed");
    closeLaunch();
  }

  const current = help === null ? null : TAB_HELP[LAUNCH_TABS[help]];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Esc dentro da calculadora fecha só ela; o "Lançar" continua aberto
        onEscapeKeyDown={(e) => {
          if (calcOpen && e.target instanceof Element && e.target.closest(`[${CALCULATOR_ATTR}]`)) {
            e.preventDefault();
            closeCalc();
          }
        }}
        className={calcOpen ? "max-w-[980px] sm:grid-cols-[minmax(0,1fr)_272px] sm:items-start" : "max-w-[680px]"}
      >
        <div className="flex min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogTitle>Novo lançamento</DialogTitle>
            <TourHelpButton onClick={startHelp} label="Entender cada aba" />
            <button
              type="button"
              onClick={toggleCalc}
              aria-label={calcOpen ? "Fechar calculadora" : "Abrir calculadora"}
              aria-pressed={calcOpen}
              title="Calculadora"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-card transition-colors hover:bg-secondary sm:h-8 sm:w-8 ${calcOpen ? "border-primary text-primary" : "border-border-strong text-muted-foreground hover:text-foreground"}`}
            >
              <Icon name="calc" size={15} />
            </button>
          </div>
          <DialogDescription>Um só formulário para renda, despesa, compra parcelada, despesa extra e meta. A janela continua aberta para você lançar em sequência.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => openLaunch(v as LaunchTab)}>
          <TabsList className={`grid h-auto w-full grid-cols-5 gap-1 rounded-md bg-secondary p-1 ${help !== null ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}>
            <TabsTrigger value="expense" className={tabClass}>Despesa</TabsTrigger>
            <TabsTrigger value="income" className={tabClass}>Renda</TabsTrigger>
            <TabsTrigger value="credit" className={tabClass}><span className="sm:hidden">Crédito</span><span className="max-sm:hidden">Crédito parcelado</span></TabsTrigger>
            <TabsTrigger value="extra" className={tabClass}><span className="sm:hidden">Extra</span><span className="max-sm:hidden">Despesa extra</span></TabsTrigger>
            <TabsTrigger value="goal" className={tabClass}>Meta</TabsTrigger>
          </TabsList>
        </Tabs>

        {invite && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3.5">
            <p className="text-[13.5px] text-muted-foreground">Quer uma explicação rápida do que cada aba significa?</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setOnboarding(LAUNCH_TOUR_KEY, "dismissed")} className={`${btnClass.base} ${btnClass.sm}`}>Agora não</button>
              <button type="button" onClick={startHelp} className={`${btnClass.primary} ${btnClass.sm}`}>Ver explicação</button>
            </div>
          </div>
        )}

        {help !== null && current && (
          <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-[15px] font-semibold">
                <span className="num text-primary">{help + 1}/{LAUNCH_TABS.length}</span> · {current.title}
              </p>
              <button type="button" onClick={() => endHelp("dismissed")} className="text-[12.5px] font-semibold text-muted-foreground underline underline-offset-[3px] hover:text-foreground">Pular</button>
            </div>
            <p className="mt-1 text-[13.5px] text-muted-foreground">{current.text}</p>
            <div className="mt-3 flex justify-end gap-1.5">
              <button type="button" onClick={() => goTo(help - 1)} disabled={help === 0} className={`${btnClass.base} ${btnClass.sm} disabled:pointer-events-none disabled:opacity-40`}>Voltar</button>
              {help < LAUNCH_TABS.length - 1 ? (
                <button type="button" onClick={() => goTo(help + 1)} className={`${btnClass.primary} ${btnClass.sm}`}>Próximo</button>
              ) : (
                <button type="button" onClick={() => endHelp("done")} className={`${btnClass.primary} ${btnClass.sm}`}>Entendi</button>
              )}
            </div>
          </div>
        )}

        {open && <LaunchFields key={tab} kind={tab} focusName={help === null} onClose={() => onOpenChange(false)} />}
        </div>
        {/* mt: o X do card do "Lançar" fica no canto; a calculadora desce para o seu X não ficar colado nele */}
        {calcOpen && <Calculator className="sm:mt-9" />}
      </DialogContent>
    </Dialog>
  );
}

const LABELS = {
  expense: { name: "Nome da despesa", placeholder: "Ex.: Aluguel, internet...", amount: "Valor deste mês" },
  income: { name: "Nome da renda", placeholder: "Ex.: Salário, freelance...", amount: "Valor deste mês" },
  credit: { name: "Nome da compra", placeholder: "Ex.: Notebook", amount: "Valor total da compra" },
  extra: { name: "Descrição", placeholder: "Ex.: Seguro do carro", amount: "Valor" },
  goal: { name: "Nome da meta", placeholder: "Ex.: Viagem de férias", amount: "Valor da meta" },
} as const;

/** `focusName`: foca o campo de nome ao abrir; desligado durante o mini tour, para as setas navegarem as etapas. */
function LaunchFields({ kind, focusName, onClose }: { kind: LaunchTab; focusName: boolean; onClose: () => void }) {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCreditTransaction = useFinanceStore((s) => s.addCreditTransaction);
  const addExtraExpense = useFinanceStore((s) => s.addExtraExpense);
  const addGoal = useFinanceStore((s) => s.addGoal);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Moradia");
  const [fixed, setFixed] = useState(false);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState(2);
  const [recurring, setRecurring] = useState(false);
  const [piggy, setPiggy] = useState(false);
  const [extraMonth, setExtraMonth] = useState(changeMonth(currentMonth, 1));
  const [monthly, setMonthly] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  // muda a cada lançamento: reinicia o foco e o campo de nome sem fechar o modal
  const [round, setRound] = useState(0);

  const totalCents = parseBRL(amount) ?? 0;
  const installmentValue = kind === "credit" && !recurring && installments > 0 ? splitInstallments(totalCents, installments)[0] : 0;

  function reset() {
    setName("");
    setAmount("");
    setNotes("");
    setFixed(false);
    setInstallments(2);
    setRecurring(false);
    setPiggy(false);
    setMonthly("");
    setSaved("");
    setDeadline("");
    setRound((r) => r + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) return showToast({ type: "error", text: "Preencha o nome" });

    const isPiggy = kind === "goal" && piggy;
    // porquinho não tem valor de meta
    const cents = isPiggy ? 0 : parseBRL(amount);
    if (cents === null || (cents === 0 && !isPiggy)) return showToast({ type: "error", text: "Informe um valor maior que zero" });

    if (kind === "goal") {
      addGoal({
        id: crypto.randomUUID(),
        name: trimmed,
        target: cents,
        saved: parseBRL(saved) ?? 0,
        monthly: parseBRL(monthly) ?? 0,
        deadline: deadline || null,
        ...(isPiggy && { piggy: true }),
      });
      showToast({ type: "success", text: isPiggy ? `Porquinho "${trimmed}" criado` : `Meta "${trimmed}" criada` });
    } else if (kind === "credit") {
      addCreditTransaction({
        id: crypto.randomUUID(),
        name: trimmed,
        totalAmount: cents,
        installments: recurring ? 1 : Math.min(60, Math.max(1, Math.floor(installments) || 1)),
        startMonth: currentMonth,
        category,
        ...(recurring && { recurring: true }),
      });
      showToast({ type: "success", text: recurring ? `Compra recorrente "${trimmed}" adicionada` : `Compra parcelada "${trimmed}" adicionada` });
    } else if (kind === "income") {
      addTransaction({ id: crypto.randomUUID(), name: trimmed, amount: cents, type: "income", category: "Renda", notes: notes.trim(), fixed, month: currentMonth });
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

  const labels = kind === "credit" && recurring
    ? { name: "Nome da compra", placeholder: "Ex.: Streaming, academia...", amount: "Valor cobrado por mês" }
    : kind === "goal" && piggy
      ? { ...LABELS.goal, name: "Nome do porquinho", placeholder: "Ex.: Troca de celular" }
      : LABELS[kind];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={labels.name} htmlFor="launch-name">
        <input
          key={round}
          id="launch-name"
          autoFocus={focusName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.placeholder}
          className={inputClass}
        />
      </Field>

      {kind === "goal" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <Checkbox checked={piggy} onCheckedChange={(c) => setPiggy(Boolean(c))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">Porquinho</span>
            <span className="block text-xs text-muted-foreground">Guardado sem valor de meta: só nome, já guardado, aporte mensal e prazo. Fica fixo abaixo das metas principais.</span>
          </span>
        </label>
      )}

      <div className={kind === "credit" && !recurring ? "grid gap-4 sm:grid-cols-2" : ""}>
        {!(kind === "goal" && piggy) && (
          <Field label={labels.amount} htmlFor="launch-amount">
            <MoneyInput id="launch-amount" value={amount} onChange={setAmount} />
          </Field>
        )}

        {kind === "credit" && !recurring && (
          <Field label="Parcelas" htmlFor="launch-installments">
            <input id="launch-installments" type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={inputClass} />
          </Field>
        )}
      </div>

      {kind === "credit" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <Checkbox checked={recurring} onCheckedChange={(c) => setRecurring(Boolean(c))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">Compra recorrente</span>
            <span className="block text-xs text-muted-foreground">Sem parcelas: o mesmo valor se repete todo mês no cartão, a partir deste, até você cancelar a recorrência.</span>
          </span>
        </label>
      )}

      {kind === "credit" && (
        <p className="text-sm text-muted-foreground">
          {recurring ? (
            <>Cobrança de <strong className="text-foreground">R$ {centsToInput(totalCents) || "0,00"}</strong> todo mês, começando em {formatMonthTitle(currentMonth)}.</>
          ) : (
            <>Parcela de <strong className="text-foreground">R$ {centsToInput(installmentValue) || "0,00"}</strong>, começando em {formatMonthTitle(currentMonth)}.</>
          )}
        </p>
      )}

      {kind === "goal" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aporte mensal" hint="(opcional)" htmlFor="launch-goal-monthly">
              <MoneyInput id="launch-goal-monthly" value={monthly} onChange={setMonthly} placeholder="500,00" />
            </Field>
            <Field label="Já guardado" hint="(opcional)" htmlFor="launch-goal-saved">
              <MoneyInput id="launch-goal-saved" value={saved} onChange={setSaved} />
            </Field>
          </div>
          <Field label="Prazo" hint="(opcional)" htmlFor="launch-goal-deadline">
            <MonthPicker id="launch-goal-deadline" value={deadline} onChange={setDeadline} clearable placeholder="Sem prazo" />
          </Field>
        </>
      )}

      {kind === "extra" && (
        <Field label="Mês da despesa" htmlFor="launch-extra-month" hint="(aparece na Projeção)">
          <MonthPicker id="launch-extra-month" value={extraMonth} min={changeMonth(currentMonth, 1)} onChange={setExtraMonth} />
        </Field>
      )}

      {(kind === "expense" || kind === "credit") && (
        <Field label="Categoria" htmlFor="launch-category">
          <CategorySelect id="launch-category" value={category} onChange={setCategory} />
        </Field>
      )}

      {(kind === "expense" || kind === "income") && (
        <Field label="Observação" hint="(opcional)" htmlFor="launch-notes">
          <p className="-mt-1 text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
          <Textarea id="launch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={kind === "income" ? "Anotações sobre esta renda..." : "Anotações sobre esta despesa..."} className="min-h-[64px] rounded-md border-border-strong bg-secondary" />
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
