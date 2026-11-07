import { btnClass } from "@/components/shared/styles";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  title: string;
  description: string;
  onStart: () => void;
  /** "Agora não", Esc ou fechar */
  onDecline: () => void;
}

/** Convite exibido no primeiro acesso. */
export default function TourInvite({ open, title, description, onStart, onDecline }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDecline()}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
        <div
          className="grid h-[104px] place-items-center"
          style={{
            background:
              "radial-gradient(120% 140% at 15% 0%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(100% 120% at 90% 100%, hsl(var(--k2)) 0%, transparent 55%), hsl(var(--card))",
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 6px 14px rgb(0 0 0 / 0.35))" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M15.5 8.5l-2 5-5 2 2-5z" />
          </svg>
        </div>
        <div className="p-6">
          <DialogTitle className="font-display text-[21px] font-semibold tracking-[-0.02em]">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-[14px]">
            {description}
          </DialogDescription>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={onStart} className={`${btnClass.primary} !px-4 !py-2.5 !text-[14px]`}>Começar tour</button>
            <button type="button" onClick={onDecline} className={`${btnClass.base} !px-4 !py-2.5 !text-[14px]`}>Agora não</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
