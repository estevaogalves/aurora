import { useMemo, useState } from "react";
import { getBudgetLines, type BudgetLevel } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import BudgetDialog from "./BudgetDialog";
import { useTransactions } from "@/Store/selectors";

const BAR: Record<BudgetLevel, string> = { ok: "bg-primary", warn: "bg-[hsl(var(--k3))]", over: "bg-destructive" };
const TEXT: Record<BudgetLevel, string> = { ok: "text-muted-foreground", warn: "text-foreground", over: "font-semibold text-destructive" };
const LABEL: Record<BudgetLevel, string> = { ok: "", warn: "atenção", over: "estourou" };

/** Barras gasto ÷ limite das categorias com orçamento (normal, atenção a partir de 80% e estourado a partir de 100%). */
export default function BudgetBars() {
  const month = useFinanceStore((s) => s.currentMonth);
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const budgets = useFinanceStore((s) => s.budgets);
  const [editing, setEditing] = useState(false);
  const lines = useMemo(() => getBudgetLines({ transactions, creditTransactions, creditCards, extraExpenses }, budgets, month), [transactions, creditTransactions, creditCards, extraExpenses, budgets, month]);

  return (
    <div data-tour="orcamento" className="mt-4 border-t border-border pt-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Orçamento do mês</span>
        <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-bold text-primary hover:underline">
          {lines.length > 0 ? "Ajustar limites" : "Definir limites"}
        </button>
      </div>
      {lines.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">Defina um limite mensal para uma categoria e acompanhe aqui quanto já foi gasto. É só uma referência: nada é bloqueado.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lines.map((l) => (
            <li key={l.category}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[12.5px]">
                <span className="min-w-0 truncate font-semibold">{l.category}{LABEL[l.level] && <span className={`ml-1.5 text-[11px] ${l.level === "over" ? "text-destructive" : "text-muted-foreground"}`}>· {LABEL[l.level]}</span>}</span>
                <span className={`num ${TEXT[l.level]}`}>{formatBRL(l.spent)} de {formatBRL(l.limit)} · {Math.round(l.percent)}%</span>
              </div>
              <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`Orçamento de ${l.category}`} aria-valuenow={Math.round(l.percent)} aria-valuemin={0} aria-valuemax={100}>
                <i className={`block h-full rounded-full ${BAR[l.level]}`} style={{ width: `${Math.min(100, l.percent)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <BudgetDialog open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
