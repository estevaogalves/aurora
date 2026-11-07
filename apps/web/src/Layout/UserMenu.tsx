import { useNavigate } from "react-router-dom";
import Icon from "@/components/Icon";
import { btnClass } from "@/components/shared/styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DATA_SOURCE } from "@/config";
import { useAuthStore } from "@/Store/AuthStore";

/** Conta do usuário: importar dados locais e sair. Só aparece com a API ligada. */
export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (DATA_SOURCE !== "api" || !user) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Conta de ${user.email}`} className={btnClass.base}>
          <Icon name="user" size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="max-w-[220px] truncate px-2.5 py-2 text-xs text-muted-foreground">{user.name || user.email}</div>
        <DropdownMenuItem onSelect={() => navigate("/importar")}>
          <Icon name="upload" size={15} />
          Importar dados locais
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={() => void logout()}>
          <Icon name="logout" size={15} />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
