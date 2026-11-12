import { Pill } from "@/components/shared/Panel";
import { distGroupOfSource, distLabel, parseDistributionOrigin } from "@/domain";
import { useDistributionItemsFor } from "@/Store/selectors";
import { formatMonth } from "@/Utils/Date";

/**
 * Selo de uma movimentação que veio da sugestão do saldo, ex.: "Dist 1 · novembro de 2026 · Reserva de emergência".
 * Sem origem (lançada à mão), não mostra nada.
 */
export default function OriginBadge({ origin }: { origin?: string }) {
  const parsed = parseDistributionOrigin(origin);
  const group = parsed ? distGroupOfSource(parsed.source) : null;
  // o nome da fatia vem dos percentuais daquela distribuição naquele mês
  const items = useDistributionItemsFor(group ?? 1, parsed?.month);
  if (!parsed) return null;
  const slice = items.find((i) => i.id === parsed.slice)?.label ?? "Sugestão do saldo";
  return <Pill tone="good">{group ? distLabel(group) : "Distribuição"} · {formatMonth(parsed.month)} · {slice}</Pill>;
}
