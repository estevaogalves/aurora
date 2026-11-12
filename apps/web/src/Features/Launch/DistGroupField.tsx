import { Field, inputClass } from "@/components/shared/FormFields";
import { distGroupChoices, distGroupOf, distLabel, type Transaction } from "@/domain";

/**
 * Em qual distribuição da sugestão do saldo (Painel) esta renda variável entra: somada ao saldo do mês (Dist 1), numa
 * distribuição que outra renda do mesmo mês já criou, ou numa nova (Dist 2, 3...). Só marca: não muda nenhum valor.
 */
export default function DistGroupField({ id, month, transactions, exceptId, value, onChange }: {
  id: string;
  /** mês da renda: as distribuições são do mês */
  month: string;
  transactions: Transaction[];
  /** a renda em edição, que não conta como "já usada" */
  exceptId?: string;
  /** 1 = Dist 1 (saldo do mês), 2 a 20 = distribuição própria */
  value: number;
  onChange: (group: number) => void;
}) {
  const { existing, next } = distGroupChoices(transactions, month, exceptId);
  const names = (group: number) =>
    transactions.filter((t) => t.id !== exceptId && t.month === month && t.type === "income" && distGroupOf(t) === group).map((t) => t.name).join(", ");

  // o número escolhido sempre aparece, mesmo que o mês mudou e ele deixou de ser "existente" ou "próximo"
  const options: { group: number; label: string }[] = [
    { group: 1, label: `Somar ao saldo do mês (${distLabel(1)})` },
    ...existing.map((g) => ({ group: g, label: `Somar à ${distLabel(g)}${names(g) ? ` · ${names(g)}` : ""}` })),
    ...(next !== null ? [{ group: next, label: `Nova distribuição (${distLabel(next)})` }] : []),
  ];
  if (!options.some((o) => o.group === value)) options.push({ group: value, label: `Nova distribuição (${distLabel(value)})` });

  return (
    <Field label="Distribuição do saldo" htmlFor={id} hint="(13º, bônus)">
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
        {options.map((o) => <option key={o.group} value={o.group}>{o.label}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">No Painel, cada distribuição tem a sua página e os seus percentuais. A Dist 1 é o saldo do mês.</span>
    </Field>
  );
}
