import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import Panel, { Empty } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { MAX_CENTS, yieldOnCost, type DividendAsset } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";

const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ao ano`);

/**
 * Carteira de dividendos, só manual (sem corretora): ativo, valor investido e proventos recebidos por mês, com o yield on
 * cost de cada um e o da carteira. É só um acompanhamento: não entra em saldo, patrimônio nem projeção.
 */
export default function DividendPortfolio() {
  const assets = useFinanceStore((s) => s.dividendAssets);
  const add = useFinanceStore((s) => s.addDividendAsset);
  const update = useFinanceStore((s) => s.updateDividendAsset);
  const remove = useFinanceStore((s) => s.removeDividendAsset);
  const demo = useUiStore((s) => s.tourDemo) && assets.length === 0;
  const shown: DividendAsset[] = demo ? [{ id: "demo", name: "HGLG11 (exemplo)", invested: 1000000, monthlyDividends: 8000 }] : assets;
  const [editing, setEditing] = useState<string | null>(null); // id, ou "new"
  const [name, setName] = useState("");
  const [invested, setInvested] = useState("");
  const [dividends, setDividends] = useState("");
  const [error, setError] = useState("");

  const total = shown.reduce((s, a) => ({ invested: s.invested + a.invested, dividends: s.dividends + a.monthlyDividends }), { invested: 0, dividends: 0 });

  function start(asset: DividendAsset | null) {
    setEditing(asset?.id ?? "new");
    setName(asset?.name ?? "");
    setInvested(asset ? centsToInput(asset.invested) : "");
    setDividends(asset ? centsToInput(asset.monthlyDividends) : "");
    setError("");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const inv = parseBRL(invested);
    const div = dividends.trim() ? parseBRL(dividends) : 0;
    if (!name.trim()) return setError("Dê um nome ao ativo.");
    if (!inv || inv <= 0) return setError("Informe o valor investido, maior que zero.");
    if (div === null) return setError("Os proventos por mês não são um valor válido.");
    if (inv > MAX_CENTS || div > MAX_CENTS) return setError("O valor passa do limite de R$ 1 bilhão.");
    const values = { name: name.trim().slice(0, 60), invested: inv, monthlyDividends: div };
    if (editing && editing !== "new") update(editing, values);
    else add({ id: uuid(), ...values });
    setEditing(null);
  }

  return (
    <Panel
      tour="sim-carteira"
      title="Minha carteira de dividendos"
      subtitle="Manual, sem corretora: o que você investiu e quanto recebe de proventos por mês"
      action={!demo && editing === null ? <button type="button" onClick={() => start(null)} className={`${btnClass.base} ${btnClass.sm}`}>Adicionar ativo</button> : undefined}
    >
      {shown.length === 0 && editing === null && <Empty>Adicione os ativos que pagam dividendos (ações, FIIs...) para acompanhar o yield on cost: proventos do mês × 12 ÷ valor investido.</Empty>}

      {shown.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 text-[13.5px]">
              <span className="min-w-0 break-words font-semibold">{a.name}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink2">
                <span>Investido <b className="num text-foreground">{formatBRL(a.invested)}</b></span>
                <span>Proventos <b className="num text-foreground">{formatBRL(a.monthlyDividends)}</b>/mês</span>
                <b className="text-foreground">{pct(yieldOnCost(a.monthlyDividends, a.invested))}</b>
                {!demo && (
                  <span className="flex gap-3">
                    <button type="button" onClick={() => start(a)} className="text-[12.5px] font-bold text-primary hover:underline">Editar</button>
                    <button type="button" onClick={() => remove(a.id)} className="text-[12.5px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Remover</button>
                  </span>
                )}
              </span>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2.5 text-[13.5px] font-bold">
            <span>Carteira</span>
            <span className="num">{formatBRL(total.invested)} investidos · {formatBRL(total.dividends)}/mês · {pct(yieldOnCost(total.dividends, total.invested))}</span>
          </li>
        </ul>
      )}

      {editing !== null && (
        <form onSubmit={save} noValidate className="mt-3 flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ativo" htmlFor="div-name"><input id="div-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: HGLG11" className={inputClass} /></Field>
            <Field label="Valor investido" htmlFor="div-invested"><MoneyInput id="div-invested" value={invested} onChange={setInvested} placeholder="10.000,00" /></Field>
            <Field label="Proventos por mês" hint="(média)" htmlFor="div-dividends"><MoneyInput id="div-dividends" value={dividends} onChange={setDividends} placeholder="80,00" /></Field>
          </div>
          {error && <p role="alert" className="text-[13px] font-semibold text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className={`${btnClass.base} ${btnClass.sm}`}>Cancelar</button>
            <button type="submit" className={`${btnClass.primary} ${btnClass.sm}`}>Salvar</button>
          </div>
        </form>
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">Só um acompanhamento: não entra em saldo, patrimônio nem projeção. Não é recomendação de investimento.</p>
    </Panel>
  );
}
