import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import OriginBadge from "@/components/shared/OriginBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FAMILY_LABEL,
  MAX_CENTS,
  MOVEMENT_DONE,
  MOVEMENT_LABEL,
  PRODUCT_SUGGESTIONS,
  formatDateBR,
  getFields,
  namePlaceholder,
  ratePlaceholder,
  sortMovements,
  todayISO,
  treasuryIndexer,
  type InvestmentFamily,
  type InvestmentMovement,
  type InvestmentMovementType,
} from "@/domain";
import { canAutoFocus } from "@/lib/device";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import { useFinanceStore, type Investment } from "@/Store/FinanceStore";
import { showToast } from "../Warnings/toast";

const FAMILIES = Object.keys(FAMILY_LABEL) as InvestmentFamily[];
const MAX_LABEL = "R$ 1 bilhão";

/** Erro dentro do formulário, junto dos campos (o aviso flutuante some e fica longe do modal). */
function FormMessage({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "warning" }) {
  if (!children) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-[13px] font-semibold ${tone === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border-strong bg-secondary text-ink2"}`}>
      {children}
    </p>
  );
}

const NEGATIVE_MSG = "Não use sinal negativo. Para tirar dinheiro, escolha Resgate.";
const NEGATIVE_MSG_FORM = "Não use sinal negativo: apague o \"-\" do campo.";

/**
 * Erro do formulário que some sozinho assim que qualquer campo muda.
 * `sig` identifica os valores atuais dos campos; o erro só aparece enquanto eles forem os mesmos de quando ele foi gerado.
 */
function useFormError(sig: string) {
  const [err, setErr] = useState({ msg: "", sig: "" });
  return [err.sig === sig ? err.msg : "", (msg: string) => setErr({ msg, sig })] as const;
}

/** Linha de total/resumo, em caixa própria para não colar nos campos. */
function Summary({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-secondary px-3 py-2 text-[13px] text-muted-foreground">{children}</p>;
}

/** "12,5" -> 12.5; vazio ou inválido -> undefined. */
function parseQuantity(text: string): number | undefined {
  const n = Number(text.trim().replace(/\./g, "").replace(",", "."));
  return text.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Só dígitos e uma vírgula, para campos de quantidade. Um "-" no início é mantido para a validação recusar. */
const cleanQuantity = (raw: string) => {
  const sign = raw.trimStart().startsWith("-") ? "-" : "";
  const value = raw.replace(/[^0-9,]/g, "");
  const [int, ...rest] = value.split(",");
  return sign + (rest.length === 0 ? int : `${int},${rest.join("").slice(0, 6)}`);
};

const qtyText = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });

/** Criar (investment = null) ou editar um investimento. O valor atual só muda por movimentação. */
export function InvestmentDialog({ open, investment, onClose }: { open: boolean; investment: Investment | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* clicar fora não fecha: evita perder o que foi digitado */}
      <DialogContent className="max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{investment ? "Editar investimento" : "Novo investimento"}</DialogTitle>
          <DialogDescription>
            {investment ? "Ajuste os dados. Para mudar o valor, use Movimentar." : "Registro manual, sem ligação com o banco ou a corretora. O valor atual você atualiza depois, em Movimentar."}
          </DialogDescription>
        </DialogHeader>
        {open && <InvestmentFields key={investment?.id ?? "new"} investment={investment} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/** Todas as opções do select de tipo, agrupadas por família. Um produto antigo fora da lista entra no grupo dele. */
function typeOptions(investment: Investment | null): Record<InvestmentFamily, string[]> {
  const out = Object.fromEntries(FAMILIES.map((k) => [k, [...PRODUCT_SUGGESTIONS[k]]])) as Record<InvestmentFamily, string[]>;
  if (investment?.product && !out[investment.family].includes(investment.product)) out[investment.family].push(investment.product);
  return out;
}

function InvestmentFields({ investment, onClose }: { investment: Investment | null; onClose: () => void }) {
  const addInvestment = useFinanceStore((s) => s.addInvestment);
  const updateInvestment = useFinanceStore((s) => s.updateInvestment);
  const movements = useFinanceStore((s) => s.investmentMovements);
  const options = typeOptions(investment);
  // cotas e preço médio vêm das movimentações quando elas trazem quantidade
  const derivedQty = !!investment && movements.some((m) => m.investmentId === investment.id && m.quantity != null);

  const [typeKey, setTypeKey] = useState(`${investment?.family ?? "fixed"}|${investment?.product ?? options[investment?.family ?? "fixed"][0]}`);
  const [name, setName] = useState(investment?.name ?? "");
  const [institution, setInstitution] = useState(investment?.institution ?? "");
  const [appliedAt, setAppliedAt] = useState(investment?.appliedAt ?? todayISO());
  const [invested, setInvested] = useState("");
  const [maturityDate, setMaturityDate] = useState(investment?.maturityDate ?? "");
  const [indexer, setIndexer] = useState(investment?.indexer ?? "");
  const [rate, setRate] = useState(investment?.rate ?? "");
  const [liquidity, setLiquidity] = useState(investment?.liquidity ?? "");
  const [graceUntil, setGraceUntil] = useState(investment?.graceUntil ?? "");
  const [earlyRedeem, setEarlyRedeem] = useState(investment?.earlyRedeem ?? false);
  const [quantity, setQuantity] = useState(investment?.quantity ? qtyText(investment.quantity) : "");
  const [avgPrice, setAvgPrice] = useState(investment?.avgPrice ? centsToInput(investment.avgPrice) : "");
  const [redeemDays, setRedeemDays] = useState(investment?.redeemDays != null ? String(investment.redeemDays) : "");
  const [ticker, setTicker] = useState(investment?.ticker ?? "");
  const [fees, setFees] = useState(investment?.fees ?? "");
  const [notes, setNotes] = useState(investment?.notes ?? "");
  const sig = JSON.stringify([typeKey, name, institution, appliedAt, invested, maturityDate, indexer, rate, liquidity, graceUntil, earlyRedeem, quantity, avgPrice, redeemDays, ticker, fees, notes]);
  const [error, setError] = useFormError(sig);
  // um "-" no campo bloqueia o envio até o usuário apagá-lo
  const negative = [invested, quantity, avgPrice].some((v) => v.includes("-"));

  const [family, product] = typeKey.split("|") as [InvestmentFamily, string];
  const f = getFields(family, product);
  // ação, FII e ETF: o valor investido é cotas × preço, então o cadastro pede cotas e preço
  const byQuantity = !investment && family === "equity";
  const qty = parseQuantity(quantity);
  const price = parseBRL(avgPrice);
  const investedCents = byQuantity ? (qty && price ? Math.round(qty * price) : 0) : (parseBRL(invested) ?? 0);
  const hasDetails = !!(investment && (investment.rate || investment.indexer || investment.liquidity || investment.graceUntil || investment.quantity || investment.avgPrice || investment.redeemDays != null || investment.ticker || investment.fees || investment.notes));
  const showQtyInDetails = f.quantity && !byQuantity && !derivedQty;
  // aviso (não bloqueia): cotas × preço médio que não batem com o valor investido
  const mismatch = !investment && !byQuantity && qty && price && investedCents > 0 && Math.abs(qty * price - investedCents) > investedCents * 0.01;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (negative) return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Dê um nome ao investimento.");
    if (!institution.trim()) return setError("Informe o banco, a corretora ou a plataforma.");
    if (!appliedAt) return setError("Informe a data da aplicação.");
    if (maturityDate && f.maturity && maturityDate < appliedAt) return setError(`O vencimento (${formatDateBR(maturityDate)}) não pode ser anterior à aplicação (${formatDateBR(appliedAt)}).`);
    if (graceUntil && f.liquidity && graceUntil < appliedAt) return setError("A carência não pode terminar antes da aplicação.");
    if (!investment) {
      if (byQuantity && !qty) return setError("Informe a quantidade de cotas, maior que zero.");
      if (byQuantity && !price) return setError("Informe o preço por cota, maior que zero.");
      if (investedCents <= 0) return setError("Informe o valor investido, maior que zero.");
      if (investedCents > MAX_CENTS) return setError(`O valor investido passa do limite de ${MAX_LABEL}.`);
    }
    if (f.quantity && quantity.trim() && !qty) return setError("A quantidade precisa ser um número maior que zero.");

    // só guarda os campos que o tipo usa
    const shared = {
      name: trimmed,
      family,
      product,
      institution: institution.trim(),
      appliedAt,
      maturityDate: f.maturity && maturityDate ? maturityDate : undefined,
      indexer: family === "treasury" ? treasuryIndexer(product) : f.indexer && indexer.trim() ? indexer.trim() : undefined,
      rate: f.rate && rate.trim() ? rate.trim() : undefined,
      liquidity: f.liquidity && liquidity.trim() ? liquidity.trim() : undefined,
      graceUntil: f.liquidity && graceUntil ? graceUntil : undefined,
      earlyRedeem: f.liquidity && earlyRedeem ? true : undefined,
      redeemDays: f.redeemDays && redeemDays.trim() ? Number(redeemDays) : undefined,
      ticker: f.ticker && ticker.trim() ? ticker.trim() : undefined,
      fees: fees.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (investment) {
      updateInvestment(investment.id, {
        ...shared,
        ...(derivedQty ? {} : { quantity: f.quantity ? qty : undefined, avgPrice: f.quantity ? (price ?? undefined) : undefined }),
      });
      showToast({ type: "success", text: `Investimento "${trimmed}" atualizado` });
    } else {
      const unitPrice = qty ? (price ?? Math.round(investedCents / qty)) : undefined;
      // o valor atual começa igual ao investido; depois se atualiza em Movimentar
      addInvestment(
        { id: uuid(), currentValue: investedCents, ...shared, quantity: f.quantity ? qty : undefined, avgPrice: f.quantity ? unitPrice : undefined },
        { amount: investedCents, ...(f.quantity && qty ? { quantity: qty, unitPrice } : {}) },
      );
      showToast({ type: "success", text: `Investimento "${trimmed}" registrado` });
    }
    onClose();
  }

  const quantityLabel = family === "other" ? "Quantidade" : "Quantidade de cotas";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Tipo" htmlFor="inv-type">
        <select id="inv-type" value={typeKey} onChange={(e) => setTypeKey(e.target.value)} className={inputClass}>
          {FAMILIES.map((k) => (
            <optgroup key={k} label={FAMILY_LABEL[k]}>
              {options[k].map((p) => <option key={p} value={`${k}|${p}`}>{p}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Nome" htmlFor="inv-name">
        <input id="inv-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder(product)} className={inputClass} />
      </Field>

      <Field label="Banco, corretora ou plataforma" htmlFor="inv-institution">
        <input id="inv-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex.: Banco A" className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {byQuantity ? (
          <>
            <Field label="Quantidade de cotas" htmlFor="inv-quantity">
              <input id="inv-quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(cleanQuantity(e.target.value))} placeholder="100" className={inputClass} />
            </Field>
            <Field label="Preço por cota" htmlFor="inv-avg">
              <MoneyInput id="inv-avg" value={avgPrice} onChange={setAvgPrice} keepSign placeholder="30,00" />
            </Field>
          </>
        ) : (
          !investment && (
            <Field label="Valor investido" htmlFor="inv-invested">
              <MoneyInput id="inv-invested" value={invested} onChange={setInvested} keepSign placeholder="5.000,00" />
            </Field>
          )
        )}
        <Field label="Data da aplicação" htmlFor="inv-applied">
          <input id="inv-applied" type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className={inputClass} />
        </Field>
        {f.maturity && (
          <Field label="Vencimento" hint="(vazio se não tiver)" htmlFor="inv-maturity">
            <input id="inv-maturity" type="date" min={appliedAt || undefined} value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} className={inputClass} />
          </Field>
        )}
      </div>
      {byQuantity && investedCents > 0 && (
        <Summary>Valor investido: <b className="num text-foreground">{formatBRL(investedCents)}</b></Summary>
      )}
      {mismatch && (
        <FormMessage tone="warning">
          ⚠ {qtyText(qty)} × {formatBRL(price)} dão {formatBRL(Math.round(qty * price))}, e o valor investido é {formatBRL(investedCents)}. Confira antes de registrar.
        </FormMessage>
      )}

      <details open={hasDetails} className="rounded-md border border-border">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-[13px] font-semibold text-ink2">Mais detalhes <span className="font-normal text-muted-foreground">(opcional)</span></summary>
        <div className="flex flex-col gap-4 border-t border-border p-3">
          {(f.indexer || f.rate) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {f.indexer && (
                <Field label="Indexador" htmlFor="inv-indexer">
                  <input id="inv-indexer" value={indexer} onChange={(e) => setIndexer(e.target.value)} placeholder="CDI, IPCA, Pré" className={inputClass} />
                </Field>
              )}
              {f.rate && (
                <Field label="Taxa contratada" htmlFor="inv-rate">
                  <input id="inv-rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={ratePlaceholder(product)} className={inputClass} />
                </Field>
              )}
            </div>
          )}
          {f.liquidity && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Liquidez" htmlFor="inv-liquidity">
                  <input id="inv-liquidity" value={liquidity} onChange={(e) => setLiquidity(e.target.value)} placeholder="Diária, no vencimento, D+30" className={inputClass} />
                </Field>
                <Field label="Carência até" htmlFor="inv-grace">
                  <input id="inv-grace" type="date" value={graceUntil} onChange={(e) => setGraceUntil(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
                <input type="checkbox" checked={earlyRedeem} onChange={(e) => setEarlyRedeem(e.target.checked)} />
                Permite resgate antes do vencimento
              </label>
            </>
          )}
          {(f.ticker || showQtyInDetails || f.redeemDays) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {f.ticker && (
                <Field label={family === "fund" ? "CNPJ ou código" : family === "other" ? "Código do ativo" : "Ticker"} htmlFor="inv-ticker">
                  <input id="inv-ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder={family === "fund" ? "Código do fundo" : family === "other" ? "Ex.: BTC" : "Ex.: ITSA4"} className={inputClass} />
                </Field>
              )}
              {showQtyInDetails && (
                <>
                  <Field label={quantityLabel} htmlFor="inv-quantity">
                    <input id="inv-quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(cleanQuantity(e.target.value))} placeholder="100" className={inputClass} />
                  </Field>
                  <Field label="Preço médio" htmlFor="inv-avg">
                    <MoneyInput id="inv-avg" value={avgPrice} onChange={setAvgPrice} keepSign placeholder="10,00" />
                  </Field>
                </>
              )}
              {f.redeemDays && (
                <Field label="Prazo de resgate (dias)" htmlFor="inv-redeem">
                  <input id="inv-redeem" inputMode="numeric" value={redeemDays} onChange={(e) => setRedeemDays(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 30" className={inputClass} />
                </Field>
              )}
            </div>
          )}
          {f.quantity && derivedQty && (
            <p className="text-[12.5px] text-muted-foreground">As cotas e o preço médio são calculados pelas movimentações. Para mudar, registre ou edite um aporte ou resgate.</p>
          )}
          <Field label="Taxas e imposto" htmlFor="inv-fees">
            <input id="inv-fees" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="Ex.: IR regressivo, taxa de adm. 0,5%" className={inputClass} />
          </Field>
          <Field label="Observações" htmlFor="inv-notes">
            <input id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </details>

      <FormMessage>{negative ? NEGATIVE_MSG_FORM : error}</FormMessage>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={negative}>{investment ? "Salvar" : "Registrar"}</Button>
      </div>
    </form>
  );
}

/** Aporte, resgate, rendimento ou atualização do valor atual. Com `movement`, edita uma movimentação já registrada. */
export function MovementDialog({ investment, movement, open, onClose }: { investment: Investment | null; movement?: InvestmentMovement | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open && !!investment} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{movement ? "Editar movimentação" : "Movimentar"} “{investment?.name}”</DialogTitle>
          <DialogDescription>Valor atual: {investment ? formatBRL(investment.currentValue) : ""}.</DialogDescription>
        </DialogHeader>
        {investment && <MovementFields key={movement?.id ?? investment.id} investment={investment} movement={movement ?? null} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

const MOVEMENT_HINT: Record<InvestmentMovementType, string> = {
  contribution: "Dinheiro novo colocado neste investimento.",
  redemption: "Dinheiro retirado (total ou parcial).",
  yield: "Ganho que se soma ao valor atual, sem ser aporte.",
  adjustment: "Informe quanto o investimento vale hoje; o lucro é recalculado.",
};

function MovementFields({ investment, movement, onClose }: { investment: Investment; movement: InvestmentMovement | null; onClose: () => void }) {
  const addMovement = useFinanceStore((s) => s.addInvestmentMovement);
  const updateMovement = useFinanceStore((s) => s.updateInvestmentMovement);
  const [type, setType] = useState<InvestmentMovementType>(movement?.type ?? "contribution");
  const [amount, setAmount] = useState(movement ? centsToInput(movement.amount) : "");
  const [quantity, setQuantity] = useState(movement?.quantity ? qtyText(movement.quantity) : "");
  const [price, setPrice] = useState(movement?.unitPrice ? centsToInput(movement.unitPrice) : "");
  const [date, setDate] = useState(movement?.date ?? todayISO());
  const [note, setNote] = useState(movement?.note ?? "");
  const sig = JSON.stringify([type, amount, quantity, price, date, note]);
  const [error, setError] = useFormError(sig);
  const negative = [amount, quantity, price].some((v) => v.includes("-"));

  // ação, FII, ETF e investimentos que controlam cotas: aporte e resgate pedem quantidade e preço
  const trackQty = investment.family === "equity" || investment.quantity != null;
  const byQuantity = trackQty && (type === "contribution" || type === "redemption");
  const qty = parseQuantity(quantity);
  const unit = parseBRL(price);
  const total = byQuantity ? (qty && unit ? Math.round(qty * unit) : 0) : (parseBRL(amount) ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (negative) return;
    if (!date) return setError("Informe a data.");
    if (date < investment.appliedAt) return setError(`A data não pode ser anterior à aplicação (${formatDateBR(investment.appliedAt)}).`);
    if (byQuantity) {
      if (!qty) return setError("Informe a quantidade de cotas, maior que zero.");
      if (!unit) return setError("Informe o preço por cota, maior que zero.");
      if (type === "redemption" && !movement && investment.quantity != null && qty > investment.quantity) return setError(`Você tem ${qtyText(investment.quantity)} cotas; o resgate é de ${qtyText(qty)}.`);
    } else if (parseBRL(amount) === null) {
      return setError(type === "adjustment" ? "Informe o novo valor atual." : "Informe um valor válido, maior que zero.");
    } else if (type !== "adjustment" && total <= 0) {
      return setError("O valor precisa ser maior que zero.");
    }
    if (total > MAX_CENTS) return setError(`O valor passa do limite de ${MAX_LABEL}.`);
    if (type === "redemption" && !movement && total > investment.currentValue) return setError(`O resgate (${formatBRL(total)}) é maior que o valor atual (${formatBRL(investment.currentValue)}).`);

    const fields = { type, date, amount: total, quantity: byQuantity ? qty : undefined, unitPrice: byQuantity ? (unit ?? undefined) : undefined, note: note.trim() || undefined };
    if (movement) updateMovement(movement.id, fields);
    else addMovement({ id: uuid(), investmentId: investment.id, ...fields });
    showToast({ type: "success", text: `${MOVEMENT_DONE[type]} em "${investment.name}"` });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="O que aconteceu" htmlFor="mov-type" hint={MOVEMENT_HINT[type]}>
        <select id="mov-type" value={type} onChange={(e) => setType(e.target.value as InvestmentMovementType)} className={inputClass}>
          {(Object.keys(MOVEMENT_LABEL) as InvestmentMovementType[]).map((k) => <option key={k} value={k}>{MOVEMENT_LABEL[k]}</option>)}
        </select>
      </Field>
      {byQuantity ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantidade de cotas" htmlFor="mov-qty">
              <input
                id="mov-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(cleanQuantity(e.target.value))}
                placeholder="10"
                className={inputClass}
              />
            </Field>
            <Field label="Preço por cota" htmlFor="mov-price">
              <MoneyInput id="mov-price" value={price} onChange={setPrice} keepSign placeholder="30,00" />
            </Field>
          </div>
          {total > 0 && <Summary>Total: <b className="num text-foreground">{formatBRL(total)}</b></Summary>}
          {type === "redemption" && (
            <p className="text-[12.5px] text-muted-foreground">O valor atual cai pelo total resgatado. Se o preço da cota mudou, depois registre uma Atualização de valor.</p>
          )}
        </>
      ) : (
        <Field label={type === "adjustment" ? "Novo valor atual" : "Valor"} htmlFor="mov-amount">
          <MoneyInput id="mov-amount" value={amount} onChange={setAmount} keepSign />
        </Field>
      )}
      <Field label="Data" htmlFor="mov-date">
        <input id="mov-date" type="date" min={investment.appliedAt} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Observação" hint="(opcional)" htmlFor="mov-note">
        <input id="mov-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sobra do mês" className={inputClass} />
      </Field>
      <FormMessage>{negative ? NEGATIVE_MSG : error}</FormMessage>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={negative}>{movement ? "Salvar" : "Registrar"}</Button>
      </div>
    </form>
  );
}

/** Histórico de um investimento, da data mais recente para a mais antiga, com editar e excluir. */
export function HistoryDialog({ investment, open, onClose, onEdit }: { investment: Investment | null; open: boolean; onClose: () => void; onEdit: (m: InvestmentMovement) => void }) {
  const movements = useFinanceStore((s) => s.investmentMovements);
  const remove = useFinanceStore((s) => s.removeInvestmentMovement);
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = investment ? sortMovements(movements.filter((m) => m.investmentId === investment.id)).reverse() : [];

  return (
    <Dialog open={open && !!investment} onOpenChange={(next) => { if (!next) { setConfirming(null); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de “{investment?.name}”</DialogTitle>
          <DialogDescription>Aportes, resgates, rendimentos e atualizações de valor. Ao corrigir ou excluir, o valor atual é recalculado.</DialogDescription>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {list.map((m) => (
              <li key={m.id} className="flex flex-col gap-1.5 py-2.5 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <b>{MOVEMENT_LABEL[m.type]}</b>
                    <span className="text-muted-foreground"> · {formatDateBR(m.date)}</span>
                  </span>
                  <span className={`num font-semibold ${m.type === "redemption" ? "text-destructive" : ""}`}>
                    {m.type === "redemption" ? "−" : ""}{formatBRL(m.amount)}
                  </span>
                </div>
                {m.quantity != null && m.unitPrice != null && (
                  <span className="text-[12px] text-muted-foreground">{qtyText(m.quantity)} {m.quantity === 1 ? "cota" : "cotas"} a {formatBRL(m.unitPrice)}</span>
                )}
                {(m.note || m.origin) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                    <OriginBadge origin={m.origin} />
                    {m.note && <span className="break-words">{m.note}</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setConfirming(null); onEdit(m); }} className="text-[12px] font-semibold text-primary hover:underline">Editar</button>
                  {confirming === m.id ? (
                    <>
                      <button type="button" onClick={() => { remove(m.id); setConfirming(null); showToast({ type: "success", text: "Movimentação excluída" }); }} className="text-[12px] font-semibold text-destructive hover:underline">Confirmar exclusão</button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-[12px] text-muted-foreground hover:underline">Cancelar</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirming(m.id)} className="text-[12px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Excluir</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
