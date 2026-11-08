import type { ReactNode } from "react";
import { sanitizeAmountInput } from "@/lib/money";

export const inputClass =
  "w-full rounded-md border border-border-strong bg-secondary px-3 py-2.5 text-base text-foreground sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] font-bold text-ink2">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function MoneyInput({ id, value, onChange, disabled, placeholder = "0,00" }: { id: string; value: string; onChange?: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(sanitizeAmountInput(e.target.value))}
        className={`${inputClass} pl-9 font-semibold`}
      />
    </div>
  );
}

/** Aviso dos campos de texto livre: o app não precisa de dados sensíveis e não deve guardá-los. */
export const FREE_TEXT_WARNING = "Não digite números de cartão, senhas, CPF, RG ou outros documentos aqui.";
