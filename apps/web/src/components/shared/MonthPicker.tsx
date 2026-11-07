import { useState } from "react";
import Icon from "@/components/Icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMonthTitle, getCurrentMonth } from "@/Utils/Date";

interface Props {
  id?: string;
  /** "AAAA-MM", ou "" quando não há mês escolhido */
  value: string;
  onChange: (month: string) => void;
  /** menor e maior mês permitidos ("AAAA-MM") */
  min?: string;
  max?: string;
  /** mostra o botão "Limpar" (para campos opcionais) */
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => {
  const text = new Date(2000, i, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
});

const key = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

/**
 * Escolha de mês e ano: um botão que abre uma grade com os 12 meses e as setas de ano.
 * Substitui o `<input type="month">`, que muda de visual em cada navegador e é ruim no celular.
 */
export default function MonthPicker({ id, value, onChange, min, max, clearable, placeholder = "Escolher mês", className }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || max || getCurrentMonth()).slice(0, 4)));

  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;
  const outside = (k: string) => (min !== undefined && k < min) || (max !== undefined && k > max);
  const today = getCurrentMonth();

  function pick(k: string) {
    onChange(k);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        // ao abrir, mostra o ano do valor atual
        if (o) setYear(Number((value || max || today).slice(0, 4)));
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          className={cn(
            "flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-secondary px-3 py-2.5 text-left text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:min-h-0 sm:text-sm",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ? formatMonthTitle(value) : placeholder}</span>
          <Icon name="calendar" size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="pointer-events-auto w-[min(300px,calc(100vw-2rem))] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Ano anterior" disabled={year <= minYear} onClick={() => setYear(year - 1)} className="grid h-10 w-10 place-items-center rounded-md text-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
            <Icon name="chevronL" size={16} />
          </button>
          <span className="num font-display text-[17px] font-semibold" aria-live="polite">{year}</span>
          <button type="button" aria-label="Próximo ano" disabled={year >= maxYear} onClick={() => setYear(year + 1)} className="grid h-10 w-10 place-items-center rounded-md text-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
            <Icon name="chevronR" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Meses de ${year}`}>
          {MONTH_LABELS.map((label, i) => {
            const k = key(year, i);
            const selected = k === value;
            return (
              <button
                key={k}
                type="button"
                disabled={outside(k)}
                aria-pressed={selected}
                onClick={() => pick(k)}
                className={cn(
                  "h-11 rounded-md text-[14px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-30",
                  selected ? "bg-primary text-primary-foreground" : k === today ? "border border-primary text-foreground hover:bg-secondary" : "text-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {(clearable || !outside(today)) && (
          <div className="mt-2.5 flex justify-between gap-2 border-t border-border pt-2.5">
            {!outside(today) ? (
              <button type="button" onClick={() => pick(today)} className="min-h-10 rounded-md px-2 text-[13px] font-semibold text-primary hover:bg-secondary">Mês atual</button>
            ) : <span />}
            {clearable && value && (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="min-h-10 rounded-md px-2 text-[13px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">Limpar</button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
