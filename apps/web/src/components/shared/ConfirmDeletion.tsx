import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDeletionProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Item fixo: some só no mês visto e pode ser restaurado. */
  hideOnly?: boolean;
  /** Ex.: "despesa fixa", "renda fixa". */
  itemLabel?: string;
}

export default function ConfirmDeletion({
  open,
  onCancel,
  onConfirm,
  hideOnly,
  itemLabel = "item",
}: ConfirmDeletionProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hideOnly ? "Ocultar neste mês?" : "Confirmar exclusão"}</DialogTitle>
          <DialogDescription>
            {hideOnly
              ? `Esta ${itemLabel} será ocultada apenas neste mês e poderá ser restaurada.`
              : `Este ${itemLabel} será removido permanentemente.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {hideOnly ? "Ocultar" : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
