import Icon from "@/components/Icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RowMenuProps {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  /** omitido: o item "Fixar" não aparece */
  onPin?: () => void;
  pinned?: boolean;
  /** texto do item de fixar quando não está fixado */
  pinLabel?: string;
  unpinLabel?: string;
  /** só em compras parceladas: "Adiantar parcela" */
  onAdvance?: () => void;
  deleteLabel?: string;
}

/** Botão ⋮ que abre Editar, Excluir e Fixar como atalho. */
export default function RowMenu({ label, onEdit, onDelete, onPin, pinned, pinLabel = "Fixar como atalho", unpinLabel = "Desafixar", deleteLabel = "Excluir", onAdvance }: RowMenuProps) {
  return (
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
        <DropdownMenuItem onSelect={onEdit}>
          <Icon name="edit" size={15} />
          Editar
        </DropdownMenuItem>
        {onPin && (
          <DropdownMenuItem onSelect={onPin}>
            <Icon name="pin" size={15} />
            {pinned ? unpinLabel : pinLabel}
          </DropdownMenuItem>
        )}
        {onAdvance && (
          <DropdownMenuItem onSelect={onAdvance}>
            <Icon name="calendar" size={15} />
            Adiantar parcela
          </DropdownMenuItem>
        )}
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Icon name="trash" size={15} />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
