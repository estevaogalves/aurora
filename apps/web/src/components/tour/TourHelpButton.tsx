import { cn } from "@/lib/utils";

/** Botão redondo com ?, usado para refazer um tour. */
export default function TourHelpButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("grid h-10 w-10 shrink-0 sm:h-8 sm:w-8 place-items-center rounded-full border border-border-strong bg-card text-[15px] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", className)}
    >
      ?
    </button>
  );
}
