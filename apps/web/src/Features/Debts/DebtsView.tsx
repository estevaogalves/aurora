import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import MonthPicker from "@/components/shared/MonthPicker";
import Panel, { Empty, Pill } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { btnClass } from "@/components/shared/styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_CENTS, anticipableInstallments, anticipatedMonths, debtProgress, detectedPayment, earlyPayoff, formatPaymentDate, getDebtTotals, getPaidInstallments, hasAnticipations, splitDebts, type Debt } from "@/domain";
import { centsToInput, formatBRL, formatBRLShort, parseBRL } from "@/lib/money";
import Pager from "@/components/shared/Pager";
import { usePagination } from "@/lib/usePagination";
import { uuid } from "@/lib/uuid";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { compareMonths, formatMonthTitle, getCurrentMonth, getMonthsBetween } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

const MAX_INSTALLMENTS = 600;

const DEMO: Debt[] = [
  { id: "demo-1", name: "Consórcio moto (exemplo)", installmentValue: 69700, totalInstallments: 60, paidInstallments: 12, nextMonth: getCurrentMonth() },
  { id: "demo-2", name: "Celular parcelado (exemplo)", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: getCurrentMonth() },
];

/** Dívidas e consórcios em parcelas fixas: o que falta, quando quita e o que cai da despesa fixa depois. Só acompanhamento. */
export default function DebtsView() {
  const debts = useFinanceStore((s) => s.debts);
  const transactions = useFinanceStore((s) => s.transactions);
  const removeDebt = useFinanceStore((s) => s.removeDebt);
  const payInstallment = useFinanceStore((s) => s.payDebtInstallment);
  const demo = useUiStore((s) => s.tourDemo) && debts.length === 0;
  const shown = demo ? DEMO : debts;
  const { active, paidOff } = useMemo(() => splitDebts(shown), [shown]);
  // com o vínculo, o valor da parcela acompanha a despesa fixa (um desconto lançado num mês vale para a parcela daquele mês)
  const totals = useMemo(() => getDebtTotals(shown, transactions), [shown, transactions]);
  const [paying, setPaying] = useState<{ debt: Debt; month: string; value: number } | null>(null);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [anticipating, setAnticipating] = useState<Debt | null>(null);
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
        <StatCard label="Saldo a pagar" value={formatBRLShort(totals.balance)} hint="parcelas restantes × valor, sem juros" />
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
          const p = debtProgress(d, transactions);
          const linked = transactions.find((t) => t.id === d.linkedTransactionId);
          const found = demo ? null : detectedPayment(d, transactions);
          const sim = simulating === d.id ? earlyPayoff(d, parseBRL(discount) ?? 0, transactions) : null;
          return (
            <article key={d.id} data-tour={i === 0 ? "div-card" : undefined} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <h4 className="break-words font-display text-base font-semibold">{d.name}</h4>
                  {linked && <div className="mt-1.5"><Pill>Vinculada a “{linked.name}”</Pill></div>}
                </div>
                <span className="num text-[20px] font-semibold">{p.percent}%</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} /></div>
              {[
                ["Parcelas", `${d.totalInstallments - p.remaining} pagas${anticipatedMonths(d).length > 0 ? ` (${anticipatedMonths(d).length} ${anticipatedMonths(d).length === 1 ? "antecipada" : "antecipadas"})` : ""} · ${p.remaining} restantes de ${d.totalInstallments}`],
                [linked ? "Parcela do mês (acompanha a despesa fixa)" : "Valor da parcela", formatBRL(p.nextValue)],
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
              {found && (
                <p className="rounded-md bg-secondary px-3 py-2 text-[12.5px] text-ink2">
                  A despesa vinculada já foi paga em {formatPaymentDate(found.date)}. <button type="button" onClick={() => payInstallment(d.id)} className="font-bold text-primary hover:underline">Registrar a parcela de {formatMonthTitle(found.month)}</button>
                </p>
              )}
              {sim && (
                <div data-tour="div-simular" className="flex flex-col gap-2 rounded-md border border-border p-3 text-[12.5px]">
                  <Field label="Desconto informado pelo banco" htmlFor={`disc-${d.id}`}>
                    <MoneyInput id={`disc-${d.id}`} value={discount} onChange={setDiscount} placeholder="0,00" />
                  </Field>
                  <span>Para quitar tudo hoje: <b className="num text-foreground">{formatBRL(sim.toPay)}</b>{sim.saved > 0 && <> (economiza <b className="num text-success">{formatBRL(sim.saved)}</b>)</>}. Só uma simulação: nada é registrado.</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {/* com despesa fixa vinculada, o pagamento é feito em Lançamentos e a parcela é registrada aqui sozinha */}
                {!d.linkedTransactionId && (
                  <button type="button" disabled={demo} onClick={() => setPaying({ debt: d, month: d.nextMonth, value: p.nextValue })} className={`${btnClass.primary} ${btnClass.sm}`}>
                    <Icon name="check" size={14} />
                    Registrar parcela paga
                  </button>
                )}
                {linked && (
                  <button type="button" disabled={demo} onClick={() => setAnticipating(d)} className={`${btnClass.base} ${btnClass.sm}`}>Antecipar parcelas</button>
                )}
                <button type="button" disabled={demo} onClick={() => { setSimulating(simulating === d.id ? null : d.id); setDiscount(""); }} className={`${btnClass.base} ${btnClass.sm}`}>Simular quitação antecipada</button>
                <button type="button" disabled={demo} onClick={() => setEditing(d)} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
                <button type="button" disabled={demo} onClick={() => setDeleting(d)} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
                  <Icon name="trash" size={14} />
                  Excluir
                </button>
              </div>
              {!demo && p.paidTotal > 0 && <PaidInstallments debt={d} linked={!!linked} />}
            </article>
          );
        })}
      </div>

      {paidOff.length > 0 && (
        <section aria-label="Dívidas quitadas" className="mt-6">
          <h3 className="mb-2.5 font-display text-[16px] font-semibold">Quitadas</h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card px-4">
            {paidOff.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13.5px]">
                <span className="min-w-0 break-words font-semibold">{d.name} <span className="font-normal text-muted-foreground">· {d.totalInstallments} parcelas de {formatBRL(d.installmentValue)}</span></span>
                <span className="flex items-center gap-3">
                  <b className="num">{formatBRL(d.totalInstallments * d.installmentValue)}</b>
                  <button type="button" onClick={() => setDeleting(d)} className="text-[12.5px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Excluir</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PayConfirm
        request={paying}
        onClose={() => setPaying(null)}
        onConfirm={(amount) => {
          if (paying) {
            payInstallment(paying.debt.id, amount);
            showToast({ type: "success", text: `Parcela de ${formatMonthTitle(paying.month)} registrada: ${formatBRL(amount)}` });
          }
          setPaying(null);
        }}
      />
      <AnticipateDialog debt={anticipating} onClose={() => setAnticipating(null)} />
      <DebtDialog open={creating || !!editing} debt={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <ConfirmDeletion
        open={!!deleting}
        itemLabel={deleting ? `dívida "${deleting.name}"` : "dívida"}
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
          <DialogTitle>{debt ? "Editar dívida" : "Nova dívida ou consórcio"}</DialogTitle>
          <DialogDescription>Parcelas fixas. É só um acompanhamento: o Aurora não cria nem muda despesas.</DialogDescription>
        </DialogHeader>
        {open && <DebtFields key={debt?.id ?? "new"} debt={debt} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DebtFields({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const addDebt = useFinanceStore((s) => s.addDebt);
  const updateDebt = useFinanceStore((s) => s.updateDebt);
  const fixed = useFinanceStore((s) => s.transactions).filter((t) => t.fixed && t.type === "expense");
  const [name, setName] = useState(debt?.name ?? "");
  const [value, setValue] = useState(debt ? centsToInput(debt.installmentValue) : "");
  const [total, setTotal] = useState(debt ? String(debt.totalInstallments) : "");
  const [paid, setPaid] = useState(debt ? String(debt.paidInstallments) : "0");
  const [nextMonth, setNextMonth] = useState(debt?.nextMonth ?? getCurrentMonth());
  const [linked, setLinked] = useState(debt?.linkedTransactionId ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [error, setError] = useState("");
  // com parcelas antecipadas o calendário é fixo: as parcelas pagas e o mês da próxima não se editam aqui
  const locked = !!debt && hasAnticipations(debt);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // com despesa fixa vinculada, o valor da parcela vem dela (Lançamentos); o campo nem aparece
    const linkedTx = fixed.find((t) => t.id === linked);
    const cents = linkedTx ? linkedTx.amount : parseBRL(value);
    const totalN = Number(total);
    const paidN = Number(paid);
    if (!name.trim()) return setError("Dê um nome à dívida.");
    if (!cents || cents <= 0) return setError("Informe o valor da parcela, maior que zero.");
    if (cents > MAX_CENTS) return setError("O valor da parcela passa de R$ 1 bilhão.");
    if (!Number.isInteger(totalN) || totalN < 1 || totalN > MAX_INSTALLMENTS) return setError(`O total de parcelas vai de 1 a ${MAX_INSTALLMENTS}.`);
    if (locked && totalN < debt.totalInstallments) return setError("Com parcelas antecipadas, o total de parcelas não pode diminuir.");
    if (!Number.isInteger(paidN) || paidN < 0 || paidN > totalN) return setError("As parcelas pagas vão de 0 até o total.");
    if (!nextMonth) return setError("Informe o mês da próxima parcela.");
    // vinculada: os valores pagos de cada parcela passam a vir do lançamento (sem valor próprio guardado)
    const values = { name: name.trim(), installmentValue: cents, totalInstallments: totalN, paidInstallments: paidN, nextMonth, linkedTransactionId: linked || undefined, note: note.trim() || undefined, ...(linked && { paidValues: undefined }) };
    if (debt) updateDebt(debt.id, values);
    else addDebt({ id: uuid(), ...values });
    showToast({ type: "success", text: debt ? `Dívida "${values.name}" atualizada` : `Dívida "${values.name}" cadastrada` });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="debt-name">
        <input id="debt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Consórcio da moto" className={inputClass} />
      </Field>
      <div className={`grid gap-4 ${linked ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {!linked && <Field label="Valor da parcela" htmlFor="debt-value"><MoneyInput id="debt-value" value={value} onChange={setValue} placeholder="697,00" /></Field>}
        <Field label="Total de parcelas" htmlFor="debt-total">
          <input id="debt-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="60" className={inputClass} />
        </Field>
        {!locked && (
          <Field label="Parcelas já pagas" htmlFor="debt-paid">
            <input id="debt-paid" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputClass} />
          </Field>
        )}
      </div>
      {!locked && <Field label="Mês da próxima parcela" htmlFor="debt-next"><MonthPicker id="debt-next" value={nextMonth} onChange={setNextMonth} /></Field>}
      {locked && <p className="rounded-md bg-secondary px-3 py-2 text-xs text-ink2">Esta dívida tem parcelas antecipadas: as parcelas pagas e o mês da próxima seguem o pagamento da despesa fixa vinculada.</p>}
      <Field label="Despesa fixa vinculada" hint="(opcional)" htmlFor="debt-linked">
        <select id="debt-linked" value={linked} onChange={(e) => {
          setLinked(e.target.value);
          // despesa fixa parcelada: o total de parcelas vem do calendário dela (início até o término)
          const t = fixed.find((x) => x.id === e.target.value);
          if (t?.endMonth) setTotal(String(Math.min(MAX_INSTALLMENTS, getMonthsBetween(t.month, t.endMonth).length)));
        }} className={inputClass}>
          <option value="">Nenhuma</option>
          {fixed.map((t) => <option key={t.id} value={t.id}>{t.name} ({formatBRL(t.amount)})</option>)}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          {linked
            ? "O total de parcelas vem do término da despesa, se ela for parcelada. O valor da parcela vem desta despesa fixa, em Lançamentos: se mudar lá, muda aqui. Ao pagar a despesa, a parcela é registrada nesta aba sozinha."
            : "Escolha a despesa fixa que já traz esta parcela no seu orçamento: o valor não é somado duas vezes, e a Projeção mostra quando ela cai."}
        </p>
      </Field>
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

/** Confirmação ao registrar uma parcela como paga: mostra o mês e o valor, que pode ser ajustado (desconto ou acréscimo). */
function PayConfirm({ request, onClose, onConfirm }: { request: { debt: Debt; month: string; value: number } | null; onClose: () => void; onConfirm: (amount: number) => void }) {
  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar parcela paga?</DialogTitle>
          <DialogDescription>{request ? `${request.debt.name} · parcela de ${formatMonthTitle(request.month)}. A próxima parcela passa para o mês seguinte.` : ""}</DialogDescription>
        </DialogHeader>
        {request && <PayFields key={`${request.debt.id}-${request.month}`} request={request} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function PayFields({ request, onClose, onConfirm }: { request: { debt: Debt; month: string; value: number }; onClose: () => void; onConfirm: (amount: number) => void }) {
  const [value, setValue] = useState(centsToInput(request.value));
  const [error, setError] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(value);
    if (cents === null) return setError("Informe o valor pago (0 se a parcela foi abonada).");
    if (cents > MAX_CENTS) return setError("O valor passa do limite de R$ 1 bilhão.");
    onConfirm(cents);
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Valor pago nesta parcela" htmlFor="pay-value" hint={request.debt.linkedTransactionId ? "(vem da despesa fixa vinculada neste mês)" : undefined}>
        <MoneyInput id="pay-value" value={value} onChange={(v) => { setValue(v); setError(""); }} />
      </Field>
      <p className="text-xs text-muted-foreground">Se você recebeu ou deu um desconto neste mês (ou pagou a mais), ajuste o valor: ele fica registrado nesta parcela e entra no total já pago.</p>
      {error && <p role="alert" className="text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Registrar parcela</Button>
      </div>
    </form>
  );
}

/** As parcelas já pagas de uma dívida, 6 por página, com o valor de cada uma e a correção dele (desconto ou acréscimo). */
function PaidInstallments({ debt, linked }: { debt: Debt; linked: boolean }) {
  const transactions = useFinanceStore((s) => s.transactions);
  const setPaidValue = useFinanceStore((s) => s.setDebtPaidValue);
  const undoAnticipation = useFinanceStore((s) => s.undoAnticipation);
  const [open, setOpen] = useState(false);
  const list = getPaidInstallments(debt, transactions);
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
                  {x.anticipated && <span className="ml-1.5"><Pill>antecipada</Pill></span>}
                </span>
                {x.anticipated ? (
                  <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <span className="text-muted-foreground">valia <span className="num">{formatBRL(x.originalValue ?? 0)}</span>, pago <b className="num text-foreground">{formatBRL(x.value)}</b></span>
                    {!transactions.some((t) => t.id === x.transactionId) && <span className="font-semibold text-destructive">lançamento removido</span>}
                    {compareMonths(x.month, debt.nextMonth) >= 0 && <button type="button" onClick={() => undoAnticipation(debt.id, x.month)} className="font-bold text-primary hover:underline">Desfazer antecipação</button>}
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
                    {/* com vínculo, o valor vem de Lançamentos (um desconto lá muda a parcela aqui) */}
                    {!linked && <button type="button" onClick={() => { setEditing(x.month); setValue(centsToInput(x.value)); setError(""); }} className="font-bold text-primary hover:underline">Editar valor</button>}
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

/** Antecipar parcelas de uma dívida vinculada: escolhe os meses, informa o valor negociado e confirma. */
function AnticipateDialog({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  return (
    <Dialog open={!!debt} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Antecipar parcelas</DialogTitle>
          <DialogDescription>{debt ? `${debt.name}. Cada parcela antecipada vira um lançamento avulso já pago neste mês, e o mês dela passa a valer R$ 0 na despesa fixa.` : ""}</DialogDescription>
        </DialogHeader>
        {debt && <AnticipateFields key={debt.id} debt={debt} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AnticipateFields({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const transactions = useFinanceStore((s) => s.transactions);
  const anticipate = useFinanceStore((s) => s.anticipateInstallments);
  const options = useMemo(() => anticipableInstallments(debt, transactions), [debt, transactions]);
  const [rows, setRows] = useState<{ month: string; value: string }[]>([{ month: options[options.length - 1]?.month ?? "", value: "" }]);
  const [error, setError] = useState("");
  const original = (month: string) => options.find((o) => o.month === month)?.value ?? 0;
  const parsed = rows.map((r) => parseBRL(r.value));
  const total = parsed.reduce<number>((s, v) => s + (v ?? 0), 0);
  const savedTotal = rows.reduce((s, r, i) => s + (parsed[i] !== null ? Math.max(0, original(r.month) - (parsed[i] ?? 0)) : 0), 0);
  const mustPayFirst = compareMonths(debt.nextMonth, getCurrentMonth()) <= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (parsed.some((v) => v === null || v <= 0)) return setError("Informe o valor pago de cada parcela, maior que zero.");
    const result = anticipate(debt.id, rows.map((r, i) => ({ month: r.month, paidValue: parsed[i]! })));
    if (result) return setError(result);
    showToast({ type: "success", text: `${rows.length === 1 ? "Parcela antecipada" : `${rows.length} parcelas antecipadas`}: ${formatBRL(total)} lançados em Lançamentos` });
    onClose();
  }

  if (options.length === 0) {
    return (
      <>
        <p className="text-[13px] text-muted-foreground">Não há parcelas em aberto depois da próxima para antecipar.</p>
        <div className="flex justify-end"><Button type="button" variant="secondary" onClick={onClose}>Fechar</Button></div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {mustPayFirst && (
        <p role="note" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[12.5px] text-ink2">
          Pague primeiro a parcela de {formatMonthTitle(debt.nextMonth)} em Lançamentos: a antecipação vai junto com o pagamento da parcela em aberto mais próxima.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Field label="Parcela a antecipar" htmlFor={`ant-month-${i}`}>
            <select id={`ant-month-${i}`} value={r.month} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))} className={inputClass}>
              {options.filter((o) => o.month === r.month || !rows.some((x) => x.month === o.month)).map((o) => <option key={o.month} value={o.month}>Parcela {o.number} · {formatMonthTitle(o.month)}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
            <span className="text-muted-foreground">Valor original da parcela</span>
            <b className="num">{formatBRL(original(r.month))}</b>
          </div>
          <Field label="Valor pago na antecipação" htmlFor={`ant-value-${i}`}>
            <MoneyInput id={`ant-value-${i}`} value={r.value} onChange={(v) => { setRows(rows.map((x, j) => (j === i ? { ...x, value: v } : x))); setError(""); }} placeholder="200,00" />
          </Field>
          {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="self-start text-[12.5px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Tirar esta parcela</button>}
        </div>
      ))}
      {rows.length < options.length && (
        <button type="button" onClick={() => setRows([...rows, { month: options.find((o) => !rows.some((x) => x.month === o.month))!.month, value: "" }])} className="self-start text-[12.5px] font-bold text-primary hover:underline">+ Antecipar outra parcela</button>
      )}
      <p className="rounded-md bg-secondary px-3 py-2 text-[12.5px] text-ink2">
        Total desta antecipação: <b className="num text-foreground">{formatBRL(total)}</b>
        {savedTotal > 0 && <> · desconto de <b className="num text-success">{formatBRL(savedTotal)}</b></>}. Vai para Lançamentos deste mês, somado à parcela do mês.
      </p>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Antecipar</Button>
      </div>
    </form>
  );
}
