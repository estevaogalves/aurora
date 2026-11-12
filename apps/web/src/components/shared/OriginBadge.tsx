import { Pill } from "@/components/shared/Panel";
import { BALANCE_SOURCE, parseDistributionOrigin } from "@/domain";
import { useDistributionItems } from "@/Store/selectors";
import { useFinanceStore } from "@/Store/FinanceStore";
import { formatMonth } from "@/Utils/Date";

/**
 * Selo de uma movimentação que veio da sugestão do saldo, ex.: "Saldo de novembro de 2026 · Reserva de emergência"
 * (ou "13º salário · Investimentos", quando veio de uma renda distribuída à parte). Sem origem, não mostra nada.
 */
export default function OriginBadge({ origin }: { origin?: string }) {
  const parsed = parseDistributionOrigin(origin);
  const items = useDistributionItems();
  const income = useFinanceStore((s) => (parsed && parsed.source !== BALANCE_SOURCE ? s.transactions.find((t) => t.id === parsed.source) : undefined));
  if (!parsed) return null;
  const slice = items.find((i) => i.id === parsed.slice)?.label ?? "Sugestão do saldo";
  const source = parsed.source === BALANCE_SOURCE ? `Saldo de ${formatMonth(parsed.month)}` : income ? `${income.name} (${formatMonth(parsed.month)})` : `Renda de ${formatMonth(parsed.month)}`;
  return <Pill tone="good">{source} · {slice}</Pill>;
}
