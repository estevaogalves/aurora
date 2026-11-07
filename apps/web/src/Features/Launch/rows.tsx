import type { ReactNode } from "react";
import { Pill } from "@/components/shared/Panel";
import { formatBRL } from "@/lib/money";
import type { Category } from "@/Types/Category";
import { categoryColors } from "@/Utils/categoryColors";

/** Linha do protótipo B: quadradinho de categoria, nome com meta e valor à direita. */
export function Row({
  color,
  name,
  meta,
  amount,
  amountClass = "",
  actions,
  below,
}: {
  color: string;
  name: ReactNode;
  meta?: ReactNode;
  amount: ReactNode;
  amountClass?: string;
  actions?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0">
      <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />
      <div className="min-w-0">
        <div className="min-w-0 break-words font-semibold">{name}</div>
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">{meta}</div>}
        {below}
      </div>
      <div className="flex items-center gap-2">
        <span className={`num text-right font-bold ${amountClass}`}>{amount}</span>
        {actions}
      </div>
    </div>
  );
}

export function ProgressMini({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1.5 h-[5px] w-full min-w-[60px] overflow-hidden rounded-full bg-secondary">
      <i className="block h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

export interface ExpenseLine {
  id: string;
  name: string;
  category: Category;
  amount: number;
  fixed?: boolean;
  /** "2/10" para parcelas */
  installment?: string;
  progress?: { value: number; max: number };
}

/** Linha somente leitura de despesa (Painel). */
export function ExpenseStaticRow({ line }: { line: ExpenseLine }) {
  return (
    <Row
      color={categoryColors[line.category]}
      name={line.name}
      meta={
        <>
          {line.category}
          {line.fixed && <Pill tone="fix">Fixa</Pill>}
          {line.installment && <Pill>Parcela {line.installment}</Pill>}
        </>
      }
      amount={formatBRL(line.amount)}
      below={line.progress && <ProgressMini {...line.progress} />}
    />
  );
}
