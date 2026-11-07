import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  accent: "bg-accent/10 text-accent",
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

/** Bloco de indicador: rótulo, valor grande e uma linha de apoio. */
export default function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  className,
}: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border border-border bg-card p-5", className)}>
      {icon && (
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl", TONES[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="truncate font-display text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
