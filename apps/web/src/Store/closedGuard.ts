import { useCallback, useState } from "react";
import { useFinanceStore } from "./FinanceStore";

/**
 * Mês fechado: editar pede confirmação ("reabrir mês"). `guard(fn)` devolve uma função que roda `fn` direto se o mês está
 * aberto; se está fechado, guarda `fn` e pede a confirmação (o diálogo lê `pending`, `confirm` e `cancel`). Confirmar
 * reabre o mês e roda a ação. O fechamento nunca apaga nem muda lançamentos, e reabrir só tira a marca e o retrato.
 */
export function useClosedGuard(month?: string) {
  const current = useFinanceStore((s) => s.currentMonth);
  const target = month ?? current;
  const closed = useFinanceStore((s) => !!s.closings[target]);
  const reopen = useFinanceStore((s) => s.reopenMonth);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const run = useCallback((fn: () => void) => (closed ? setPending(() => fn) : fn()), [closed]);
  const guard = useCallback((fn: () => void) => () => run(fn), [run]);
  const confirm = useCallback(() => {
    const fn = pending;
    setPending(null);
    reopen(target);
    fn?.();
  }, [pending, reopen, target]);
  const cancel = useCallback(() => setPending(null), []);

  return { month: target, closed, open: pending !== null, run, guard, confirm, cancel };
}
