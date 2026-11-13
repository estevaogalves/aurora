import Icon from "@/components/Icon";
import ReopenMonthDialog from "@/components/shared/ReopenMonthDialog";
import { useClosedGuard } from "@/Store/closedGuard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RowMenuProps {
  label: string;
  /** omitido: o item "Editar" não aparece (parcela gerada por dívida) */
  onEdit?: () => void;
  /** omitido: o item de excluir não aparece */
  onDelete?: () => void;
  /** omitido: o item "Fixar" não aparece */
  onPin?: () => void;
  pinned?: boolean;
  /** texto do item de fixar quando não está fixado */
  pinLabel?: string;
  unpinLabel?: string;
  /** só em compras parceladas: "Adiantar parcela" */
  onAdvance?: () => void;
  /** só em compras recorrentes ainda ativas: "Cancelar recorrência" */
  onCancelRecurrence?: () => void;
  /** só em fixas: "Encerrar a partir daqui" */
  onEnd?: () => void;
  /** só em despesas: "Marcar como paga" (ou "Editar pagamento", se `paid`) */
  onPay?: () => void;
  paid?: boolean;
  /** só em despesa já paga: "Desmarcar pagamento" */
  onClearPay?: () => void;
  deleteLabel?: string;
  /** mês do item, se não for o mês visto (mês fechado pede confirmação antes de editar) */
  month?: string;
}

/** Botão ⋮ que abre Editar, Excluir e Fixar como atalho. */
export default function RowMenu({ label, onEdit, onDelete, onPin, pinned, pinLabel = "Fixar como atalho", unpinLabel = "Desafixar", deleteLabel = "Excluir", onAdvance, onCancelRecurrence, onEnd, onPay, paid, onClearPay, month }: RowMenuProps) {
  const g = useClosedGuard(month);
  return (
    <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${label}`}
          className="grid h-10 w-10 place-items-center sm:h-8 sm:w-8 rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          <Icon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onSelect={g.guard(onEdit)}>
            <Icon name="edit" size={15} />
            Editar
          </DropdownMenuItem>
        )}
        {onPay && (
          <DropdownMenuItem onSelect={g.guard(onPay)}>
            <Icon name="check" size={15} />
            {paid ? "Editar pagamento" : "Marcar como paga"}
          </DropdownMenuItem>
        )}
        {onClearPay && (
          <DropdownMenuItem onSelect={g.guard(onClearPay)}>
            <Icon name="close" size={15} />
            Desmarcar pagamento
          </DropdownMenuItem>
        )}
        {onPin && (
          <DropdownMenuItem onSelect={g.guard(onPin)}>
            <Icon name="pin" size={15} />
            {pinned ? unpinLabel : pinLabel}
          </DropdownMenuItem>
        )}
        {onAdvance && (
          <DropdownMenuItem onSelect={g.guard(onAdvance)}>
            <Icon name="calendar" size={15} />
            Adiantar parcela
          </DropdownMenuItem>
        )}
        {onEnd && (
          <DropdownMenuItem onSelect={g.guard(onEnd)}>
            <Icon name="calendar" size={15} />
            Encerrar a partir daqui
          </DropdownMenuItem>
        )}
        {onCancelRecurrence && (
          <DropdownMenuItem onSelect={g.guard(onCancelRecurrence)}>
            <Icon name="close" size={15} />
            Cancelar recorrência
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem destructive onSelect={g.guard(onDelete)}>
            <Icon name="trash" size={15} />
            {deleteLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <ReopenMonthDialog open={g.open} month={g.month} onConfirm={g.confirm} onCancel={g.cancel} />
    </>
  );
}
