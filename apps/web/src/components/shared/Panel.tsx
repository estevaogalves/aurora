import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Cartão do protótipo B: título, subtítulo e uma ação opcional no canto. */
export default function Panel({ title, subtitle, action, children, className }: PanelProps) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[17px] font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">{title}</h1>
        <p className="mt-1.5 text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "fix" | "good" | "bad" | "warn" }) {
  const tones = {
    default: "border border-border bg-secondary text-ink2",
    fix: "bg-pill text-pill-foreground",
    good: "bg-good-bg text-success",
    bad: "bg-bad-bg text-destructive",
    warn: "bg-[hsl(var(--k3)/0.2)] text-foreground",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", tones[tone])}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-muted-foreground">{children}</p>;
}
