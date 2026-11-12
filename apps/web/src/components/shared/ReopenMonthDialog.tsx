import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMonthTitle } from "@/Utils/Date";

/** Confirmação para editar um mês fechado: reabrir o mês e continuar. */
export default function ReopenMonthDialog({ open, month, onConfirm, onCancel }: { open: boolean; month: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{formatMonthTitle(month)} está fechado</DialogTitle>
          <DialogDescription>
            Para editar, reabra o mês. Nenhum lançamento foi alterado pelo fechamento; reabrir só tira a marca de fechado e o retrato guardado (você pode fechar o mês de novo depois).
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={onConfirm}>Reabrir e continuar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
