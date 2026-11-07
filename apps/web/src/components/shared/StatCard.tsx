import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  /** destaque com o gradiente da cor principal */
  highlight?: boolean;
  tone?: "default" | "good" | "bad";
  className?: string;
}

/** Indicador do protótipo B: rótulo em caixa alta, valor grande e apoio. */
export default function StatCard({ label, value, hint, highlight, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border px-[18px] py-4 shadow-[var(--shadow-card)]",
        highlight
          ? "border-primary bg-[linear-gradient(135deg,hsl(var(--primary)),color-mix(in_srgb,hsl(var(--primary))_60%,hsl(var(--k2))))] text-primary-foreground"
          : "border-border bg-card",
        className,
      )}
    >
      <span className={cn("text-xs font-semibold uppercase tracking-[0.07em]", highlight ? "opacity-80" : "text-muted-foreground")}>{label}</span>
      <b className={cn("num text-[26px] font-semibold tracking-[-0.01em]", !highlight && tone === "good" && "text-success", !highlight && tone === "bad" && "text-destructive")}>{value}</b>
      {hint && <span className={cn("text-[12.5px]", highlight ? "opacity-80" : "text-muted-foreground")}>{hint}</span>}
    </div>
  );
}
