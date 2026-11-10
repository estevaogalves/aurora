import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportMyData } from "@/api/auth";
import Icon from "@/components/Icon";
import { btnClass } from "@/components/shared/styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DATA_SOURCE } from "@/config";
import { downloadText } from "@/Services/download";
import { useAuthStore } from "@/Store/AuthStore";
import { useUiStore } from "@/Store/UiStore";
import { showToast } from "@/Features/Warnings/toast";
import DeleteAccountDialog from "./AccountDialogs";

/** Conta do usuário: cartões de crédito, importar dados locais, exportar, excluir a conta e sair. Só aparece com a API ligada. */
export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const openCards = useUiStore((s) => s.openCards);
  const [deleting, setDeleting] = useState(false);

  if (DATA_SOURCE !== "api" || !user) return null;

  const exportData = async () => {
    try {
      downloadText("aurora-meus-dados.json", JSON.stringify(await exportMyData(), null, 2), "application/json");
    } catch {
      showToast({ type: "error", text: "Não foi possível exportar seus dados. Tente novamente." });
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Conta de ${user.email}`} className={btnClass.base}>
            <Icon name="user" size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="max-w-[220px] truncate px-2.5 py-2 text-xs text-muted-foreground">{user.name || user.email}</div>
          <DropdownMenuItem onSelect={openCards}>
            <Icon name="relatorios" size={15} />
            Cartões de crédito
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/importar")}>
            <Icon name="upload" size={15} />
            Importar dados locais
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportData()}>
            <Icon name="down" size={15} />
            Exportar meus dados
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
            <Icon name="trash" size={15} />
            Excluir minha conta
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => void logout()}>
            <Icon name="logout" size={15} />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}
