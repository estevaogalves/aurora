import { billingDayOf, isValidCard, todayISO } from "@/domain";
import { canAutoFocus } from "@/lib/device";
import { uuid } from "@/lib/uuid";
import MonthPicker from "@/components/shared/MonthPicker";
import { useEffect, useState } from "react";
import { CardSelect, InvoiceInfo } from "./CardField";
import CardPurchaseField from "./CardPurchaseField";
import { isISODate } from "./isoDate";
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
  "min-h-10 flex-auto whitespace-nowrap rounded-[10px] px-1.5 py-2 text-[11.5px] font-semibold sm:px-3 sm:text-[12.5px] text-ink2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow";

const LAUNCH_TABS: LaunchTab[] = ["expense", "income", "credit", "card", "extra", "goal"];

/** Mini tour do modal: o que cada aba representa. */
const TAB_HELP: Record<LaunchTab, { title: string; text: string }> = {
  expense: { title: "Despesa", text: "Um gasto do mês, como aluguel, mercado ou internet. Marque “Despesa fixa” para repetir todo mês; sem marcar, vale só neste mês. Se foi no cartão, escolha o cartão e o dia da compra: o valor entra na fatura e o pagamento é marcado na fatura, em Lançamentos." },
  income: { title: "Renda", text: "Dinheiro que entra, como salário ou freelance. A renda fixa repete todo mês; a variável vale só no mês em que foi lançada." },
  credit: { title: "Crédito parcelado", text: "Compra no cartão em várias vezes. Informe o valor total e o número de parcelas: o app divide e lança uma parcela por mês, a partir deste. Marque “Compra recorrente” para uma assinatura: um valor único, cobrado todo mês até você cancelar." },
  card: { title: "Cartão", text: "Cadastre um cartão de crédito com o dia de fechamento e o de vencimento e, se quiser, um teto mensal para acompanhar a fatura. Ao escolhê-lo em uma compra, o valor entra no mês em que a fatura vence. Para ver, editar ou excluir seus cartões, use o ícone de perfil no topo (ou a aba Cartões, no uso local)." },
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
          <DialogDescription>Um só formulário para renda, despesa, compra parcelada, cartão, despesa extra e meta. A janela continua aberta para você lançar em sequência.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => openLaunch(v as LaunchTab)}>
          <TabsList className={`flex h-auto w-full gap-1 rounded-md bg-secondary p-1 ${help !== null ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}>
            <TabsTrigger value="expense" className={tabClass}>Despesa</TabsTrigger>
            <TabsTrigger value="income" className={tabClass}>Renda</TabsTrigger>
            <TabsTrigger value="credit" className={tabClass}><span className="sm:hidden">Crédito</span><span className="max-sm:hidden">Crédito parcelado</span></TabsTrigger>
            <TabsTrigger value="card" className={tabClass}>Cartão</TabsTrigger>
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

/** Data inicial sugerida: hoje, se o mês visto é o atual; senão, o dia 1 do mês visto. */
function defaultStartDate(month: string) {
  const today = todayISO();
  return today.startsWith(month) ? today : `${month}-01`;
}

const LABELS = {
  expense: { name: "Nome da despesa", placeholder: "Ex.: Aluguel, internet...", amount: "Valor deste mês" },
  income: { name: "Nome da renda", placeholder: "Ex.: Salário, freelance...", amount: "Valor deste mês" },
  credit: { name: "Nome da compra", placeholder: "Ex.: Notebook", amount: "Valor total" },
  card: { name: "Nome do cartão", placeholder: "Ex.: Nubank", amount: "" },
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
  const addCreditCard = useFinanceStore((s) => s.addCreditCard);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Moradia");
  const [fixed, setFixed] = useState(false);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState(2);
  const [recurring, setRecurring] = useState(false);
  const [variable, setVariable] = useState(false);
  const [cardId, setCardId] = useState("");
  // dia da compra (despesa avulsa ou extra no cartão) e teto mensal (cadastro do cartão)
  const [purchaseDate, setPurchaseDate] = useState(() => defaultStartDate(currentMonth));
  const [limit, setLimit] = useState("");
  // data de início da cobrança (crédito parcelado e recorrente): dá o mês inicial e o dia das cobranças seguintes
  const [startDate, setStartDate] = useState(() => defaultStartDate(currentMonth));
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [piggy, setPiggy] = useState(false);
  // mês de uma renda/despesa: vazio = o mês que está sendo visto; dá para escolher um mês futuro
  const [txMonth, setTxMonth] = useState("");
  const [extraMonth, setExtraMonth] = useState(changeMonth(currentMonth, 1));
  const [monthly, setMonthly] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  // muda a cada lançamento: reinicia o foco e o campo de nome sem fechar o modal
  const [round, setRound] = useState(0);

  const launchMonth = txMonth || currentMonth;
  const inFuture = launchMonth !== currentMonth;
  const totalCents = parseBRL(amount) ?? 0;
  const installmentValue = kind === "credit" && !recurring && installments > 0 ? splitInstallments(totalCents, installments)[0] : 0;

  function reset() {
    setName("");
    setAmount("");
    setNotes("");
    setFixed(false);
    setVariable(false);
    setCategory("Moradia");
    setTxMonth("");
    setExtraMonth(changeMonth(currentMonth, 1));
    setInstallments(2);
    setRecurring(false);
    setVariable(false);
    setStartDate(defaultStartDate(currentMonth));
    setClosingDay("");
    setDueDay("");
    setCardId("");
    setPurchaseDate(defaultStartDate(currentMonth));
    setLimit("");
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

    if (kind === "card") {
      const card = { name: trimmed, closingDay: Number(closingDay), dueDay: Number(dueDay) };
      if (!isValidCard(card)) return showToast({ type: "error", text: "Informe os dias de fechamento e vencimento (1 a 31)" });
      const cap = limit.trim() ? parseBRL(limit) : 0;
      if (cap === null) return showToast({ type: "error", text: "Informe um teto válido ou deixe em branco" });
      addCreditCard({ id: uuid(), ...card, ...(cap > 0 && { limit: cap }) });
      showToast({ type: "success", text: `Cartão "${trimmed}" cadastrado` });
      reset();
      return;
    }

    if (kind === "credit" && !billingDayOf(startDate)) return showToast({ type: "error", text: "Informe a data de início da cobrança" });

    const isPiggy = kind === "goal" && piggy;
    // porquinho não tem valor de meta
    const cents = isPiggy ? 0 : parseBRL(amount);
    if (cents === null || (cents === 0 && !isPiggy)) return showToast({ type: "error", text: "Informe um valor maior que zero" });

    if (kind === "goal") {
      addGoal({
        id: uuid(),
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
        id: uuid(),
        name: trimmed,
        totalAmount: cents,
        installments: recurring ? 1 : Math.min(60, Math.max(1, Math.floor(installments) || 1)),
        startMonth: startDate.slice(0, 7),
        billingDay: billingDayOf(startDate),
        category,
        ...(recurring && { recurring: true }),
        ...(recurring && variable && { variableAmount: true }),
        ...(cardId && { cardId }),
      });
      showToast({ type: "success", text: recurring ? `Compra recorrente "${trimmed}" adicionada` : `Compra parcelada "${trimmed}" adicionada` });
    } else if (kind === "income") {
      addTransaction({ id: uuid(), name: trimmed, amount: cents, type: "income", category: "Renda", notes: notes.trim(), fixed, month: launchMonth, ...(fixed && variable && { variableAmount: true }) });
      showToast({ type: "success", text: `Renda "${trimmed}" adicionada${inFuture ? ` a partir de ${formatMonthTitle(launchMonth)}` : ""}` });
    } else if (kind === "extra") {
      if (cardId) {
        if (!isISODate(purchaseDate)) return showToast({ type: "error", text: "Informe a data da compra" });
        // no cartão, a despesa vale no mês da fatura, que sai do dia da compra
        addExtraExpense({ id: uuid(), name: trimmed, amount: cents, month: purchaseDate.slice(0, 7), cardId, purchaseDate });
        showToast({ type: "success", text: `Despesa extra "${trimmed}" adicionada no cartão` });
      } else {
        if (!extraMonth) return showToast({ type: "error", text: "Escolha o mês da despesa extra" });
        addExtraExpense({ id: uuid(), name: trimmed, amount: cents, month: extraMonth });
        showToast({ type: "success", text: `Despesa extra "${trimmed}" adicionada` });
      }
    } else if (cardId && !fixed) {
      if (!isISODate(purchaseDate)) return showToast({ type: "error", text: "Informe a data da compra" });
      // no cartão, o valor vale no mês da fatura (que sai do dia da compra); aqui guarda o mês da compra
      addTransaction({ id: uuid(), name: trimmed, amount: cents, type: "expense", category, notes: notes.trim(), fixed: false, month: purchaseDate.slice(0, 7), cardId, purchaseDate });
      showToast({ type: "success", text: `Despesa "${trimmed}" adicionada no cartão` });
    } else {
      addTransaction({ id: uuid(), name: trimmed, amount: cents, type: "expense", category, notes: notes.trim(), fixed, month: launchMonth, ...(fixed && variable && { variableAmount: true }) });
      showToast({ type: "success", text: `Despesa "${trimmed}" adicionada${inFuture ? ` a partir de ${formatMonthTitle(launchMonth)}` : ""}` });
    }

    reset();
  }

  const labels = kind === "credit" && recurring
    ? { name: "Nome da compra", placeholder: "Ex.: Streaming, academia...", amount: "Valor por mês" }
    : kind === "goal" && piggy
      ? { ...LABELS.goal, name: "Nome do porquinho", placeholder: "Ex.: Troca de celular" }
      : LABELS[kind];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className={kind === "credit" ? "grid gap-4 sm:grid-cols-2" : "contents"}>
        <Field label={labels.name} htmlFor="launch-name">
          <input
            key={round}
            id="launch-name"
            autoFocus={focusName && canAutoFocus()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.placeholder}
            className={inputClass}
          />
        </Field>

        {kind === "credit" && (
          <Field label={labels.amount} htmlFor="launch-amount">
            <MoneyInput id="launch-amount" value={amount} onChange={setAmount} />
          </Field>
        )}
      </div>

      {kind === "goal" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <Checkbox checked={piggy} onCheckedChange={(c) => setPiggy(Boolean(c))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">Porquinho</span>
            <span className="block text-xs text-muted-foreground">Guardado sem valor de meta: só nome, já guardado, aporte mensal e prazo. Fica fixo abaixo das metas principais.</span>
          </span>
        </label>
      )}

      {kind === "card" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dia de fechamento" htmlFor="launch-card-closing">
            <input id="launch-card-closing" type="number" inputMode="numeric" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="Ex.: 2" className={inputClass} />
          </Field>
          <Field label="Dia de vencimento" htmlFor="launch-card-due">
            <input id="launch-card-due" type="number" inputMode="numeric" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Ex.: 9" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Teto mensal da fatura" hint="(opcional)" htmlFor="launch-card-limit">
              <MoneyInput id="launch-card-limit" value={limit} onChange={setLimit} placeholder="300,00" />
            </Field>
            <p className="mt-1 text-xs text-muted-foreground">Só para acompanhar: a fatura mostra quanto do teto já foi usado. Não bloqueia nada.</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Não informe número do cartão, CVV nem CPF: só o nome, os dias e o teto. Para ver, editar ou excluir, use o ícone de perfil no topo.</p>
        </div>
      )}

      {kind !== "credit" && kind !== "card" && !(kind === "goal" && piggy) && (
        <Field label={labels.amount} htmlFor="launch-amount">
          <MoneyInput id="launch-amount" value={amount} onChange={setAmount} />
        </Field>
      )}

      {kind === "credit" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início da cobrança" htmlFor="launch-start-date">
              <input id="launch-start-date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} block min-h-11 min-w-0 max-w-full appearance-none`} />
            </Field>
            <CardSelect cardId={cardId} onChange={setCardId} onNavigate={onClose} />
          </div>
          <InvoiceInfo cardId={cardId} date={startDate} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-secondary p-3">
              <Checkbox checked={recurring} onCheckedChange={(c) => { setRecurring(Boolean(c)); if (!c) setVariable(false); }} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">Compra recorrente</span>
                <span className="block text-xs text-muted-foreground">Mesmo valor todo mês, sem parcelas, até cancelar.</span>
              </span>
            </label>
            <label className={`flex items-start gap-2.5 rounded-md border border-border bg-secondary p-3 ${recurring ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <Checkbox checked={variable} disabled={!recurring} onCheckedChange={(c) => setVariable(Boolean(c))} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">Valor variável (estimado)</span>
                <span className="block text-xs text-muted-foreground">O valor é uma estimativa; cada mês aceita o valor real.</span>
              </span>
            </label>
          </div>

          <div className={recurring ? "" : "grid items-end gap-4 sm:grid-cols-2"}>
            {!recurring && (
              <Field label="Parcelas" htmlFor="launch-installments">
                <input id="launch-installments" type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={inputClass} />
              </Field>
            )}
            <p className="pb-2.5 text-sm text-muted-foreground">
              {recurring ? (
                <>Cobrança {variable ? "estimada " : ""}de <strong className="text-foreground">R$ {centsToInput(totalCents) || "0,00"}</strong> todo mês, a partir de {formatMonthTitle(startDate.slice(0, 7) || currentMonth)}{billingDayOf(startDate) ? `, dia ${billingDayOf(startDate)}` : ""}.</>
              ) : (
                <>Parcela de <strong className="text-foreground">R$ {centsToInput(installmentValue) || "0,00"}</strong>, a partir de {formatMonthTitle(startDate.slice(0, 7) || currentMonth)}{billingDayOf(startDate) ? `, dia ${billingDayOf(startDate)}` : ""}.</>
              )}
            </p>
          </div>
        </>
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

      {kind === "extra" && !cardId && (
        <Field label="Mês da despesa" htmlFor="launch-extra-month" hint="(aparece na Projeção)">
          <MonthPicker id="launch-extra-month" value={extraMonth} min={changeMonth(currentMonth, 1)} onChange={setExtraMonth} />
        </Field>
      )}

      {kind === "extra" && <CardPurchaseField idPrefix="launch-extra" cardId={cardId} onCardChange={setCardId} date={purchaseDate} onDateChange={setPurchaseDate} onNavigate={onClose} />}

      {(kind === "expense" || kind === "credit") && (
        <Field label="Categoria" htmlFor="launch-category">
          <CategorySelect id="launch-category" value={category} onChange={setCategory} />
        </Field>
      )}

      {kind === "expense" && !fixed && <CardPurchaseField idPrefix="launch-expense" cardId={cardId} onCardChange={setCardId} date={purchaseDate} onDateChange={setPurchaseDate} onNavigate={onClose} />}

      {(kind === "expense" || kind === "income") && !(kind === "expense" && !fixed && cardId) && (
        <Field label={fixed ? "Vale a partir de" : "Mês do lançamento"} htmlFor="launch-month" hint="(pode ser um mês futuro)">
          <MonthPicker id="launch-month" value={launchMonth} min={currentMonth} onChange={setTxMonth} />
          {inFuture && <p className="mt-1 text-xs text-muted-foreground">Aparece em Lançamentos ao navegar até {formatMonthTitle(launchMonth)}{fixed ? ", e se repete nos meses seguintes" : ""}.</p>}
        </Field>
      )}

      {(kind === "expense" || kind === "income") && (
        <Field label="Observação" hint="(opcional)" htmlFor="launch-notes">
          <p className="-mt-1 text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
          <Textarea id="launch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={kind === "income" ? "Anotações sobre esta renda..." : "Anotações sobre esta despesa..."} className="min-h-[64px] rounded-md border-border-strong bg-secondary" />
        </Field>
      )}

      {/* despesa no cartão não fixa nem tem valor variável: fixa no cartão é recorrência (Crédito parcelado) */}
      {(kind === "income" || (kind === "expense" && !cardId)) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
            <Checkbox checked={fixed} onCheckedChange={(c) => { setFixed(Boolean(c)); if (!c) setVariable(false); else setCardId(""); }} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-foreground">{kind === "income" ? "Renda fixa" : "Despesa fixa"}</span>
              <span className="block text-xs text-muted-foreground">Repete todo mês a partir deste. Dá para ajustar o valor de cada mês depois.</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 rounded-md border border-border bg-secondary p-3 ${fixed ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <Checkbox checked={variable} disabled={!fixed} onCheckedChange={(c) => setVariable(Boolean(c))} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-foreground">Valor variável (estimado)</span>
              <span className="block text-xs text-muted-foreground">O valor é uma estimativa; cada mês aceita o valor real.</span>
            </span>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
        <Button type="submit">Adicionar</Button>
      </div>
    </form>
  );
}
