import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import { toggleSection, usePrefsStore } from "@/lib/preferences";

/**
 * Seção de Lançamentos que abre e fecha (como um acordeão). Vem aberta; quando o usuário fecha, fica fechada
 * (a escolha é guardada neste navegador, por `id`).
 */
export default function CollapsibleSection({ id, title, count, children, first = false }: { id: string; title: string; count?: number; children: ReactNode; first?: boolean }) {
  const collapsed = usePrefsStore((s) => s.collapsedSections.includes(id));
  const panelId = `sec-${id}`;
  return (
    <div className={first ? "" : "mt-3 border-t border-border-strong pt-3"}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={() => toggleSection(id)}
        className="flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground hover:text-foreground"
      >
        <span className={`inline-flex transition-transform ${collapsed ? "" : "rotate-90"}`}><Icon name="chevronR" size={14} /></span>
        <span>{title}</span>
        {count !== undefined && <span className="num rounded-full bg-secondary px-1.5 py-px text-[11px] font-bold normal-case tracking-normal text-ink2">{count}</span>}
      </button>
      {!collapsed && <div id={panelId} className="mt-1">{children}</div>}
    </div>
  );
}
