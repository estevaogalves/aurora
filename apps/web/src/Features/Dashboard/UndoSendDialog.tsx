import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SentSummary } from "@/domain";
import { formatBRL } from "@/lib/money";

const KIND: Record<SentSummary["targets"][number]["kind"], string> = { piggy: "porquinho", goal: "meta", investment: "investimento" };

/** O envio que será desfeito: de qual fatia de qual distribuição, quanto e para onde tinha ido. */
export interface UndoRequest {
  month: string;
  sourceId: string;
  distLabel: string;
  sliceId: string;
  sliceLabel: string;
  sent: SentSummary;
}

/**
 * Confirmação de "Desfazer envio": o valor sai do histórico de cada destino (que volta ao valor de antes) e a fatia
 * volta a mostrar "Enviar", para refazer o processo, escolhendo outro destino se quiser.
 */
export default function UndoSendDialog({ request, onConfirm, onClose }: { request: UndoRequest | null; onConfirm: (r: UndoRequest) => void; onClose: () => void }) {
  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desfazer o envio?</DialogTitle>
          <DialogDescription className="break-words">
            {request ? `${formatBRL(request.sent.total)} de “${request.sliceLabel}” (${request.distLabel}) saem do histórico de:` : ""}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <>
            <ul className="flex flex-col gap-1 rounded-md bg-secondary px-3 py-2 text-[13.5px]">
              {request.sent.targets.map((t) => (
                <li key={`${t.kind}-${t.name}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">{KIND[t.kind]} “{t.name}”</span>
                  <span className="num font-semibold">{formatBRL(t.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted-foreground">Esse valor volta a ficar disponível na fatia, e você pode enviar de novo. O que foi lançado à mão nesses destinos não muda.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="button" onClick={() => onConfirm(request)}>Desfazer envio</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
