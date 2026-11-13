import { btnClass } from "@/components/shared/styles";

/** Anterior / Próxima, com "1–8 de 30". Só aparece quando há mais de uma página. */
export default function Pager({ page, pages, from, to, total, onPage }: { page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
      <span aria-live="polite">{from}–{to} de {total}</span>
      <span className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${btnClass.base} ${btnClass.sm} disabled:pointer-events-none disabled:opacity-40`}>Anterior</button>
        <span className="num">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={`${btnClass.base} ${btnClass.sm} disabled:pointer-events-none disabled:opacity-40`}>Próxima</button>
      </span>
    </nav>
  );
}
