import { useMemo } from "react";
import Icon from "@/components/Icon";
import { inputClass } from "@/components/shared/FormFields";
import { btnClass } from "@/components/shared/styles";
import { PAYMENT_METHODS, isFilterActive, type PaymentMethod } from "@/domain";
import { formatBRL, parseBRL } from "@/lib/money";
import { useLaunchFilter } from "@/lib/launchFilter";
import { useFinanceStore } from "@/Store/FinanceStore";
import { EXPENSE_CATEGORIES } from "@/Types/Category";
import { useLaunchFiltering } from "./filtering";

/**
 * Busca e filtros de Lançamentos (texto, categoria, status, forma de pagamento, faixa de valor e tag). Só mudam o que
 * as listas mostram: os totais oficiais do mês não são recalculados.
 */
export default function FilterBar() {
  const { filter, open, setFilter, clear, toggleOpen } = useLaunchFilter();
  const custom = useFinanceStore((s) => s.customCategories);
  const transactions = useFinanceStore((s) => s.transactions);
  const view = useLaunchFiltering();
  const categories = [...EXPENSE_CATEGORIES, ...custom.map((c) => c.name), "Renda"];
  const tags = useMemo(() => [...new Set(transactions.flatMap((t) => t.tags ?? []))].sort((a, b) => a.localeCompare(b)), [transactions]);
  const active = isFilterActive(filter);
  const money = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));

  return (
    <section data-tour="filtros" aria-label="Busca e filtros" className="mb-3.5 rounded-lg border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <input
            type="search"
            aria-label="Buscar nos lançamentos"
            value={filter.text}
            onChange={(e) => setFilter({ text: e.target.value })}
            placeholder="Buscar por nome, observação, categoria ou tag"
            className={`${inputClass} w-full`}
          />
        </div>
        <button type="button" aria-expanded={open} onClick={toggleOpen} className={`${btnClass.base} ${btnClass.sm} ${open ? "!border-primary !text-primary" : ""}`}>
          <Icon name="lanc" size={14} />
          Filtros
        </button>
        {active && <button type="button" onClick={clear} className="text-[12.5px] font-bold text-primary hover:underline">Limpar</button>}
      </div>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Categoria
            <select value={filter.category} onChange={(e) => setFilter({ category: e.target.value })} className={inputClass}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Pagamento (despesas)
            <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value as typeof filter.status })} className={inputClass}>
              <option value="all">Todas</option>
              <option value="paid">Pagas</option>
              <option value="pending">Pendentes</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Forma de pagamento
            <select value={filter.method} onChange={(e) => setFilter({ method: e.target.value as "" | PaymentMethod })} className={inputClass}>
              <option value="">Qualquer</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          {tags.length > 0 && (
            <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Tag
              <select value={filter.tag} onChange={(e) => setFilter({ tag: e.target.value })} className={inputClass}>
                <option value="">Qualquer</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Valor a partir de
            <input inputMode="decimal" defaultValue={money(filter.min)} key={`min-${active}`} onChange={(e) => setFilter({ min: e.target.value.trim() ? parseBRL(e.target.value) : null })} placeholder="0,00" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink2">Valor até
            <input inputMode="decimal" defaultValue={money(filter.max)} key={`max-${active}`} onChange={(e) => setFilter({ max: e.target.value.trim() ? parseBRL(e.target.value) : null })} placeholder="sem limite" className={inputClass} />
          </label>
        </div>
      )}

      {active && (
        <p role="status" className="mt-2.5 text-[12.5px] text-ink2">
          <b>{view.summary.count}</b> {view.summary.count === 1 ? "resultado" : "resultados"}
          {view.summary.expense > 0 && <> · despesas <b className="num text-foreground">{formatBRL(view.summary.expense)}</b></>}
          {view.summary.income > 0 && <> · rendas <b className="num text-foreground">{formatBRL(view.summary.income)}</b></>}
          . <span className="text-muted-foreground">Os totais oficiais do mês não mudam com o filtro.</span>
        </p>
      )}
    </section>
  );
}
