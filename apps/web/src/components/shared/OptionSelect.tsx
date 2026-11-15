import { Children, Fragment, isValidElement, type ChangeEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isNative } from "@/platform";

/** O Radix não aceita valor "" num item: usamos um marcador interno para a opção "vazia" (ex.: "Todas"). */
const EMPTY = "__vazio__";

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
}
interface Group {
  label?: string;
  options: Opt[];
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** Lê os `<option>` e `<optgroup>` filhos (inclusive dentro de fragmentos) e devolve a lista de grupos. */
function parse(children: ReactNode, groups: Group[] = [], current: Group = { options: [] }): Group[] {
  if (!groups.includes(current)) groups.push(current);
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; label?: string; disabled?: boolean; children?: ReactNode }>;
    if (el.type === Fragment) parse(el.props.children, groups, current);
    else if (el.type === "optgroup") parse(el.props.children, groups, (groups.push({ label: el.props.label, options: [] }), groups[groups.length - 1]));
    else if (el.type === "option") {
      const label = textOf(el.props.children);
      current.options.push({ value: el.props.value == null ? label : String(el.props.value), label, disabled: el.props.disabled });
    }
  });
  return groups;
}

/**
 * Substituto do `<select>`: igual na web (seletor do navegador) e, no app Android, uma lista compacta no tema do app
 * (o seletor nativo do Android abre um diálogo branco, grande, fora do visual do Aurora). Mesma API: `<option>`,
 * `<optgroup>`, `value` e `onChange(e)` com `e.target.value`.
 */
export default function OptionSelect({ value, onChange, className, disabled, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  if (!isNative()) {
    return (
      <select id={id} value={value} onChange={onChange} className={className} disabled={disabled} {...rest}>
        {children}
      </select>
    );
  }
  const groups = parse(children).filter((g) => g.options.length > 0);
  const current = String(value ?? "");
  const known = groups.some((g) => g.options.some((o) => o.value === current));
  const emit = (v: string) => onChange?.({ target: { value: v === EMPTY ? "" : v }, currentTarget: { value: v === EMPTY ? "" : v } } as ChangeEvent<HTMLSelectElement>);
  const item = (o: Opt) => (
    <SelectItem key={o.value} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled}>
      {o.label}
    </SelectItem>
  );
  return (
    <Select value={known ? (current === "" ? EMPTY : current) : ""} onValueChange={emit} disabled={disabled}>
      <SelectTrigger id={id} aria-label={rest["aria-label"]} className={cn(className, "h-9 min-h-0 py-0 text-sm")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g, i) => (
          <SelectGroup key={g.label ?? i}>
            {g.label && <SelectLabel>{g.label}</SelectLabel>}
            {g.options.map(item)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
