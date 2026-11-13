import { useMemo, useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_CENTS, findGoalsByName, formatDateBR, makeDistributionOrigin, todayISO, type DistributionItem } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import { useFinanceStore, type Investment } from "@/Store/FinanceStore";
import { GoalDialog } from "../Goals/GoalDialogs";
import { formatMonth } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

/** O que está sendo enviado: de qual fonte e fatia da sugestão, e quanto ainda falta enviar dela. */
export interface SendRequest {
  month: string;
  sourceId: string;
  sourceLabel: string;
  slice: DistributionItem;
  /** centavos que ainda não foram enviados desta fatia */
  remaining: number;
}

type Destination = "piggy" | "goal" | "investment";

// investimentos que controlam cotas (ação, FII, ETF) pedem quantidade e preço: esses recebem o aporte em Movimentar
const byQuantity = (i: Investment) => i.family === "equity" || i.quantity != null;

const DESTINATION_LABEL: Record<Destination, string> = { piggy: "Porquinho", goal: "Meta", investment: "Investimento" };

/**
 * Atalho para mandar uma fatia da sugestão do saldo para um porquinho, uma meta ou um investimento: vira um aporte
 * no histórico do destino, com a origem ("Saldo de novembro de 2026 · Reserva"), e o saldo do Painel continua igual.
 */
export default function SendDistributionDialog({ request, onClose }: { request: SendRequest | null; onClose: () => void }) {
  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar “{request?.slice.label}”</DialogTitle>
          <DialogDescription className="break-words">
            {request ? `${request.sourceLabel} · ${formatMonth(request.month)}. Falta enviar ${formatBRL(request.remaining)}. O saldo do Painel não muda: o valor entra no histórico do destino.` : ""}
          </DialogDescription>
        </DialogHeader>
        {/* a chave reinicia os campos a cada abertura */}
        {request && <SendFields key={`${request.sourceId}-${request.slice.id}-${request.remaining}`} request={request} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SendFields({ request, onClose }: { request: SendRequest; onClose: () => void }) {
  const goals = useFinanceStore((s) => s.goals);
  const investments = useFinanceStore((s) => s.investments);
  const contributeToGoal = useFinanceStore((s) => s.contributeToGoal);
  const addInvestmentMovement = useFinanceStore((s) => s.addInvestmentMovement);

  const options = useMemo(
    () => ({
      piggy: goals.filter((g) => g.piggy).map((g) => ({ id: g.id, name: g.name })),
      goal: goals.filter((g) => !g.piggy).map((g) => ({ id: g.id, name: g.name })),
      investment: investments.filter((i) => !byQuantity(i)).map((i) => ({ id: i.id, name: i.name })),
    }),
    [goals, investments],
  );
  // a linha da sugestão (ex.: "Reserva") já aponta para a meta/porquinho de nome parecido ("Reserva de emergência"), sem ligar para acento ou maiúscula
  const matches = useMemo(() => findGoalsByName(goals, request.slice.label), [goals, request.slice.label]);
  const matched = matches[0];
  const firstWithOptions = matched ? (matched.piggy ? "piggy" : "goal") : (["piggy", "goal", "investment"] as Destination[]).find((d) => options[d].length > 0) ?? "piggy";
  const [destination, setDestination] = useState<Destination>(firstWithOptions);
  const [targetId, setTargetId] = useState(matched?.id ?? options[firstWithOptions][0]?.id ?? "");
  const [amount, setAmount] = useState(centsToInput(request.remaining));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const list = options[destination];
  // só oferece criar meta se não existe nenhuma com nome parecido (evita duplicar)
  const hasMatchingGoal = matches.length > 0;
  const [creating, setCreating] = useState<"goal" | "piggy" | null>(null);
  const cotas = investments.filter(byQuantity).length;

  function pickDestination(next: Destination) {
    setDestination(next);
    setTargetId(options[next][0]?.id ?? "");
    setError("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(amount) ?? 0;
    if (!targetId) return setError(`Escolha ${destination === "investment" ? "o investimento" : destination === "goal" ? "a meta" : "o porquinho"}.`);
    if (cents <= 0) return setError("Informe um valor maior que zero.");
    if (cents > request.remaining) return setError(`O valor passa do que falta enviar (${formatBRL(request.remaining)}).`);
    if (cents > MAX_CENTS) return setError("O valor passa do limite de R$ 1 bilhão.");
    if (!date) return setError("Informe a data.");
    const trimmed = note.trim();
    const origin = makeDistributionOrigin({ month: request.month, source: request.sourceId, slice: request.slice.id });
    const target = options[destination].find((o) => o.id === targetId);

    if (destination === "investment") {
      const inv = investments.find((i) => i.id === targetId);
      if (inv && date < inv.appliedAt) return setError(`A data não pode ser anterior à aplicação (${formatDateBR(inv.appliedAt)}).`);
      addInvestmentMovement({ id: uuid(), investmentId: targetId, type: "contribution", date, amount: cents, origin, ...(trimmed && { note: trimmed }) });
    } else {
      contributeToGoal(targetId, cents, 0, { date, origin, ...(trimmed && { note: trimmed }) });
    }
    showToast({ type: "success", text: `${formatBRL(cents)} enviados para "${target?.name}"` });
    onClose();
  }

  const noDestination = (["piggy", "goal", "investment"] as Destination[]).every((d) => options[d].length === 0);

  return (
    <>
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {noDestination ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-[13px] text-ink2">
          Você ainda não tem porquinho, meta nem investimento para receber este valor. Crie um em Lançar → Meta (ou Investimento) e volte aqui.
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Destino" className="grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary p-3">
            {(Object.keys(DESTINATION_LABEL) as Destination[]).map((d) => (
              <label key={d} className={`flex min-h-10 items-center gap-2 text-sm ${options[d].length === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <input type="radio" name="send-destination" checked={destination === d} disabled={options[d].length === 0} onChange={() => pickDestination(d)} className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                {DESTINATION_LABEL[d]}
              </label>
            ))}
          </div>
          {!hasMatchingGoal && destination !== "investment" && (
            <p className="-mb-1 rounded-md bg-secondary px-3 py-2 text-[13px] text-ink2">
              Não há meta nem porquinho com o nome “{request.slice.label}”. Quer criar um?{" "}
              <button type="button" onClick={() => setCreating("goal")} className="font-bold text-primary hover:underline">Criar meta</button>
              {" · "}
              <button type="button" onClick={() => setCreating("piggy")} className="font-bold text-primary hover:underline">Criar porquinho</button>
            </p>
          )}
          <Field label={DESTINATION_LABEL[destination]} htmlFor="send-target">
            <select id="send-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
              {list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          {destination === "investment" && cotas > 0 && (
            <p className="-mt-2 text-xs text-muted-foreground">Investimentos com cotas (ações, FIIs) não aparecem aqui: eles pedem quantidade e preço, em Metas → Investimentos → Movimentar.</p>
          )}
          <Field label="Valor" htmlFor="send-amount">
            <MoneyInput id="send-amount" value={amount} onChange={(v) => { setAmount(v); setError(""); }} />
          </Field>
          <Field label="Data" htmlFor="send-date">
            <input id="send-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Observação" hint="(opcional)" htmlFor="send-note">
            <input id="send-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: guardei no banco" className={inputClass} />
          </Field>
        </>
      )}
      {error && <p role="alert" className="rounded-md bg-secondary px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={noDestination}>Enviar</Button>
      </div>
    </form>
    {/* fora do <form>: o submit de um diálogo em portal sobe pela árvore do React e enviaria este formulário */}
    <GoalDialog
      open={creating !== null}
      goal={null}
      asPiggy={creating === "piggy"}
      initialName={request.slice.label}
      onClose={() => setCreating(null)}
      onCreated={(id) => { setDestination(creating === "piggy" ? "piggy" : "goal"); setTargetId(id); setError(""); }}
    />
    </>
  );
}
