import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import MonthPicker from "@/components/shared/MonthPicker";
import Panel, { Empty, Pill } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { btnClass } from "@/components/shared/styles";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_CENTS, debtKind, debtProgress, earlyPayoff, getDebtTotals, getPaidInstallments, isConsortium, isProgressive, prepaidList, splitDebts, validateDebtFields, type Debt, type DebtKind } from "@/domain";
import { centsToInput, formatBRL, formatBRLShort, parseBRL } from "@/lib/money";
import DebtPayDialog from "./DebtPayDialog";
import Pager from "@/components/shared/Pager";
import { usePagination } from "@/lib/usePagination";
import { uuid } from "@/lib/uuid";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { formatMonthTitle, getCurrentMonth } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

const DEMO: Debt[] = [
  { id: "demo-1", name: "Consórcio moto (exemplo)", kind: "consortium", installmentValue: 69700, totalInstallments: 60, paidInstallments: 12, nextMonth: getCurrentMonth() },
  { id: "demo-2", name: "Celular parcelado (exemplo)", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: getCurrentMonth() },
];

/** Dívidas e consórcios em parcelas fixas: o que falta, quando quita e o que cai da despesa fixa depois. Só acompanhamento. */
export default function DebtsView() {
  const debts = useFinanceStore((s) => s.debts);
  const removeDebt = useFinanceStore((s) => s.removeDebt);
  const demo = useUiStore((s) => s.tourDemo) && debts.length === 0;
  const shown = demo ? DEMO : debts;
  const { active, paidOff } = useMemo(() => splitDebts(shown), [shown]);
  const totals = useMemo(() => getDebtTotals(shown), [shown]);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <button type="button" data-tour="div-novo" onClick={() => setCreating(true)} className={btnClass.primary}>
          <Icon name="plus" size={14} />
          Nova dívida
        </button>
      </div>

      <div data-tour="div-resumo" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatCard label="Parcelas por mês" value={formatBRLShort(totals.monthly)} hint={`${totals.count} ${totals.count === 1 ? "dívida em andamento" : "dívidas em andamento"}`} highlight />
        <StatCard label="Saldo a pagar" value={formatBRLShort(totals.balance)} hint="soma das parcelas restantes, sem juros" />
        <StatCard label="Última parcela" value={totals.lastPayoff ? formatMonthTitle(totals.lastPayoff) : "—"} hint={totals.lastPayoff ? "quando tudo estiver quitado" : "nenhuma dívida em andamento"} />
      </div>

      {demo && (
        <p role="note" className="mt-3.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <b className="text-foreground">Exemplo ilustrativo.</b> Estas dívidas são fictícias, só para mostrar como a tela fica depois que você cadastrar as suas.
        </p>
      )}

      {shown.length === 0 && (
        <div className="mt-3.5">
          <Panel title="Nenhuma dívida ainda" subtitle="Consórcios, financiamentos e compras em parcelas fixas">
            <Empty>Use “Nova dívida” para acompanhar quanto falta pagar e quando a última parcela vence. Vincule à despesa fixa que já traz a parcela para a Projeção mostrar quando ela cai.</Empty>
          </Panel>
        </div>
      )}

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {active.map((d, i) => {
          const p = debtProgress(d);
          const sim = simulating === d.id ? earlyPayoff(d, parseBRL(discount) ?? 0) : null;
          return (
            <article key={d.id} data-tour={i === 0 ? "div-card" : undefined} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <h4 className="break-words font-display text-base font-semibold">{d.name}</h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Pill tone={debtKind(d)}>{isConsortium(d) ? "Consórcio" : "Dívida"}</Pill>
                    {isConsortium(d) && <Pill>{isProgressive(d) ? "Progressivo" : "Linear"}</Pill>}
                  </div>
                </div>
                <span className="num text-[20px] font-semibold">{p.percent}%</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} /></div>
              {[
                ["Parcelas", `${d.paidInstallments} ${d.paidInstallments === 1 ? "paga" : "pagas"} · ${p.remaining} ${p.remaining === 1 ? "restante" : "restantes"} de ${d.totalInstallments}`],
                [isProgressive(d) ? "Próxima parcela (valor)" : "Valor da parcela", formatBRL(p.nextValue)],
                ["Total já pago", formatBRL(p.paidTotal)],
                ["Saldo a pagar", formatBRL(p.balance)],
                ["Próxima parcela", formatMonthTitle(d.nextMonth)],
                ["Última parcela (quitação)", p.payoffMonth ? formatMonthTitle(p.payoffMonth) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 text-[12.5px]">
                  <span className="text-muted-foreground">{label}</span>
                  <b className="num text-right">{value}</b>
                </div>
              ))}
              {d.note && <p className="border-t border-border pt-2.5 text-[12.5px] text-ink2">{d.note}</p>}
              {sim && (
                <div data-tour="div-simular" className="flex flex-col gap-2 rounded-md border border-border p-3 text-[12.5px]">
                  <Field label="Desconto informado pelo banco" htmlFor={`disc-${d.id}`}>
                    <MoneyInput id={`disc-${d.id}`} value={discount} onChange={setDiscount} placeholder="0,00" />
                  </Field>
                  <span>Para quitar tudo hoje: <b className="num text-foreground">{formatBRL(sim.toPay)}</b>{sim.saved > 0 && <> (economiza <b className="num text-success">{formatBRL(sim.saved)}</b>)</>}. Só uma simulação: nada é registrado.</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {/* a parcela também pode ser marcada como paga em Lançamentos: as duas formas são a mesma coisa */}
                <button type="button" disabled={demo} onClick={() => setPaying(d)} className={`${btnClass.primary} ${btnClass.sm}`}>
                  <Icon name="check" size={14} />
                  Registrar parcela paga
                </button>
                <button type="button" disabled={demo} onClick={() => { setSimulating(simulating === d.id ? null : d.id); setDiscount(""); }} className={`${btnClass.base} ${btnClass.sm}`}>Simular quitação antecipada</button>
                <button type="button" disabled={demo} onClick={() => setEditing(d)} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
                <button type="button" disabled={demo} onClick={() => setDeleting(d)} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
                  <Icon name="trash" size={14} />
                  Excluir
                </button>
              </div>
              {!demo && p.paidTotal > 0 && <PaidInstallments debt={d} />}
            </article>
          );
        })}
      </div>

      {paidOff.length > 0 && (
        <section aria-label="Dívidas quitadas" className="mt-6">
          <h3 className="mb-2.5 font-display text-[16px] font-semibold">Quitadas</h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card px-4">
            {paidOff.map((d) => (
              <li key={d.id} className="py-3 text-[13.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words font-semibold">{d.name}</span>
                    <Pill tone={debtKind(d)}>{isConsortium(d) ? "Consórcio" : "Dívida"}</Pill>
                    <Pill tone="good">Quitado</Pill>
                    <span className="font-normal text-muted-foreground">· {d.totalInstallments} parcelas</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <b className="num">{formatBRL(debtProgress(d).paidTotal)}</b>
                    <button type="button" onClick={() => setDeleting(d)} className="text-[12.5px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Excluir</button>
                  </span>
                </div>
                {!demo && d.payments && <div className="mt-1.5"><PaidInstallments debt={d} /></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DebtPayDialog debt={paying} onClose={() => setPaying(null)} />
      <DebtDialog open={creating || !!editing} debt={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `${isConsortium(deleting) ? "consórcio" : "dívida"} "${deleting.name}" (as parcelas já pagas ficam em Lançamentos como despesas comuns; as futuras somem)` : "dívida"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeDebt(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}

function DebtDialog({ open, debt, onClose }: { open: boolean; debt: Debt | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{debt ? (isConsortium(debt) ? "Editar consórcio" : "Editar dívida") : "Nova dívida ou consórcio"}</DialogTitle>
          <DialogDescription>As parcelas aparecem sozinhas em Lançamentos, mês a mês, até a última. Não precisa cadastrar uma despesa fixa.</DialogDescription>
        </DialogHeader>
        {open && <DebtForm key={debt?.id ?? "new"} debt={debt} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

const tabClass = "flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

/** Formulário com as abas Dívida e Consórcio (ao editar, a aba é a do cadastro e não troca). */
function DebtForm({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const [kind, setKind] = useState<DebtKind>(debt ? debtKind(debt) : "debt");
  return (
    <div className="flex flex-col gap-4">
      {!debt && (
        <Tabs value={kind} onValueChange={(v) => setKind(v as DebtKind)}>
          <TabsList className="flex h-auto w-full gap-1 rounded-md bg-secondary p-1">
            <TabsTrigger value="debt" className={tabClass}>Dívida</TabsTrigger>
            <TabsTrigger value="consortium" className={tabClass}>Consórcio</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <DebtFields key={kind} kind={kind} debt={debt} onClose={onClose} />
    </div>
  );
}

function DebtFields({ kind, debt, onClose }: { kind: DebtKind; debt: Debt | null; onClose: () => void }) {
  const addDebt = useFinanceStore((s) => s.addDebt);
  const updateDebt = useFinanceStore((s) => s.updateDebt);
  const consortium = kind === "consortium";
  const [model, setModel] = useState<"linear" | "progressive">(debt?.model ?? "linear");
  const progressive = consortium && model === "progressive";
  const [name, setName] = useState(debt?.name ?? "");
  const [value, setValue] = useState(debt ? centsToInput(debt.installmentValue) : "");
  const [increment, setIncrement] = useState(debt?.increment ? centsToInput(debt.increment) : "");
  const [total, setTotal] = useState(debt ? String(debt.totalInstallments) : "");
  const [paid, setPaid] = useState(debt ? String(debt.paidInstallments) : "0");
  const [nextMonth, setNextMonth] = useState(debt?.nextMonth ?? getCurrentMonth());
  const [note, setNote] = useState(debt?.note ?? "");
  const [error, setError] = useState("");

  const totalN = Number(total);
  const cents = parseBRL(value);
  const step = parseBRL(increment);
  // na prévia: a última parcela do consórcio progressivo (inicial + (total − 1) × acréscimo)
  const lastValue = progressive && cents && step && totalN >= 1 ? cents + (totalN - 1) * step : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateDebtFields({ name, kind, model: consortium ? model : undefined, installmentValue: cents, increment: progressive ? step : undefined, total: totalN, paid: Number(paid), nextMonth });
    if (problem) return setError(problem);
    const values = {
      name: name.trim(),
      kind,
      model: consortium ? model : undefined,
      installmentValue: cents!,
      increment: progressive ? step! : undefined,
      totalInstallments: totalN,
      paidInstallments: Number(paid),
      nextMonth,
      note: note.trim() || undefined,
    };
    if (debt) updateDebt(debt.id, values);
    else addDebt({ id: uuid(), ...values });
    showToast({ type: "success", text: `${consortium ? "Consórcio" : "Dívida"} "${values.name}" ${debt ? "atualizado" : "cadastrado"}: as parcelas já estão em Lançamentos` });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {consortium && (
        <Field label="Tipo de parcela" htmlFor="debt-model">
          <select id="debt-model" value={model} onChange={(e) => { setModel(e.target.value as "linear" | "progressive"); setError(""); }} disabled={!!debt} className={inputClass}>
            <option value="linear">Linear (todas as parcelas iguais)</option>
            <option value="progressive">Progressivo (a parcela cresce todo mês)</option>
          </select>
        </Field>
      )}
      <Field label="Nome" htmlFor="debt-name">
        <input id="debt-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={consortium ? "Ex.: Consórcio da moto" : "Ex.: Financiamento do carro"} className={inputClass} />
      </Field>
      <div className={`grid gap-4 ${progressive ? "sm:grid-cols-2" : ""}`}>
        <Field label={progressive ? "Valor da primeira parcela" : "Valor da parcela"} htmlFor="debt-value">
          <MoneyInput id="debt-value" value={value} onChange={(v) => { setValue(v); setError(""); }} placeholder="100,00" />
        </Field>
        {progressive && (
          <Field label="Acréscimo mensal" htmlFor="debt-increment">
            <MoneyInput id="debt-increment" value={increment} onChange={(v) => { setIncrement(v); setError(""); }} placeholder="50,00" />
          </Field>
        )}
      </div>
      {progressive && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Parcela = primeira + (número da parcela − 1) × acréscimo. Ex.: R$ 100 com acréscimo de R$ 50: R$ 100, R$ 150, R$ 200...{lastValue !== null && <> Com este total, a última parcela será de <b className="num text-foreground">{formatBRL(lastValue)}</b>.</>}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total de parcelas" htmlFor="debt-total">
          <input id="debt-total" inputMode="numeric" value={total} onChange={(e) => { setTotal(e.target.value.replace(/\D/g, "").slice(0, 3)); setError(""); }} placeholder="60" className={inputClass} />
        </Field>
        <Field label="Parcelas já pagas" htmlFor="debt-paid">
          <input id="debt-paid" inputMode="numeric" value={paid} onChange={(e) => { setPaid(e.target.value.replace(/\D/g, "").slice(0, 3)); setError(""); }} className={inputClass} />
        </Field>
      </div>
      <Field label="Mês da próxima parcela" htmlFor="debt-next"><MonthPicker id="debt-next" value={nextMonth} onChange={(v) => { setNextMonth(v); setError(""); }} /></Field>
      {debt && <p className="-mt-2 text-xs text-muted-foreground">Mudar as parcelas pagas ou o mês da próxima recomeça o acompanhamento dos pagamentos registrados. Mudar só o valor, o total ou o nome vale para as parcelas futuras: o que já foi pago não muda.</p>}
      {totalN > 0 && Number(paid) >= totalN && <p className="-mt-2 text-xs text-muted-foreground">Com todas as parcelas pagas, fica como quitado e não gera lançamentos.</p>}
      <Field label="Observação" hint="(opcional)" htmlFor="debt-note">
        <input id="debt-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{debt ? "Salvar" : "Cadastrar"}</Button>
      </div>
    </form>
  );
}

/** As parcelas já pagas de uma dívida, 6 por página, com o valor de cada uma e a correção dele (desconto ou acréscimo). */
function PaidInstallments({ debt }: { debt: Debt }) {
  const setPaidValue = useFinanceStore((s) => s.setDebtPaidValue);
  const undoPrepaidLast = useFinanceStore((s) => s.undoPrepaidLast);
  const [open, setOpen] = useState(false);
  const list = getPaidInstallments(debt);
  const pager = usePagination(list, 6);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="border-t border-border pt-2.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[12.5px] font-bold text-primary hover:underline">
        {open ? "Esconder parcelas pagas" : `Parcelas pagas (${list.length})`}
      </button>
      {open && (
        <>
          <ul className="mt-2 flex flex-col divide-y divide-border text-[12.5px]">
            {pager.slice.map((x) => (
              <li key={x.month} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  Parcela {x.number} · {formatMonthTitle(x.month)}
                  {x.adjusted && <span className="ml-1.5 text-muted-foreground">(valor registrado)</span>}
                  {x.prepaid && <span className="ml-1.5"><Pill>paga antes</Pill></span>}
                </span>
                {x.prepaid ? (
                  <span className="flex items-center gap-3">
                    <b className="num">{formatBRL(x.value)}</b>
                    {x.number === debt.totalInstallments - prepaidList(debt).length + 1 && <button type="button" onClick={() => undoPrepaidLast(debt.id)} className="font-bold text-primary hover:underline">Desfazer</button>}
                  </span>
                ) : editing === x.month ? (
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const cents = parseBRL(value);
                      if (cents === null || cents > MAX_CENTS) return setError("Valor inválido.");
                      setPaidValue(debt.id, x.month, cents);
                      setEditing(null);
                    }}
                  >
                    <MoneyInput id={`paid-${debt.id}-${x.month}`} value={value} onChange={(v) => { setValue(v); setError(""); }} />
                    <button type="submit" className="font-bold text-primary hover:underline">Salvar</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:underline">Cancelar</button>
                  </form>
                ) : (
                  <span className="flex items-center gap-3">
                    <b className="num">{formatBRL(x.value)}</b>
                    <button type="button" onClick={() => { setEditing(x.month); setValue(centsToInput(x.value)); setError(""); }} className="font-bold text-primary hover:underline">Editar valor</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="mt-1 text-[12px] font-semibold text-destructive">{error}</p>}
          <Pager {...pager} onPage={pager.setPage} />
        </>
      )}
    </div>
  );
}
