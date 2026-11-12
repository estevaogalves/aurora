import { useState } from "react";
import Icon from "@/components/Icon";
import { btnClass } from "@/components/shared/styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DATA_SOURCE } from "@/config";
import { downloadText } from "@/Services/download";
import { useAuthStore } from "@/Store/AuthStore";
import { useUiStore } from "@/Store/UiStore";
import { BACKUP_FILENAME, buildBackup } from "@/Services/backup";
import { useFinanceStore } from "@/Store/FinanceStore";
import DeleteAccountDialog from "./AccountDialogs";
import BackupDialog from "./BackupDialog";

/**
 * Menu da conta. Com a API: cartões, backup (um exportar e um importar), excluir a conta e sair.
 * Sem a API (dados só no navegador): só o backup, para levar os dados a outro lugar.
 */
export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openCards = useUiStore((s) => s.openCards);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const api = DATA_SOURCE === "api";

  if (api && !user) return null;

  const exportBackup = () => {
    const { transactions, creditTransactions, creditCards, notes, goals, investments, investmentMovements, extraExpenses, customCategories, distribution, seenAlerts, onboarding } = useFinanceStore.getState();
    downloadText(BACKUP_FILENAME(), buildBackup({ transactions, creditTransactions, creditCards, notes, goals, investments, investmentMovements, extraExpenses, customCategories, distribution, seenAlerts, onboarding }), "application/json");
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={api ? `Conta de ${user?.email}` : "Backup dos dados"} className={`${btnClass.base} ${btnClass.icon}`}>
            <Icon name="user" size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {api && (
            <>
              <div className="max-w-[220px] truncate px-2.5 py-2 text-xs text-muted-foreground">{user?.name || user?.email}</div>
              <DropdownMenuItem onSelect={openCards}>
                <Icon name="relatorios" size={15} />
                Cartões de crédito
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={exportBackup}>
            <Icon name="down" size={15} />
            Exportar backup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setImporting(true)}>
            <Icon name="upload" size={15} />
            Importar backup
          </DropdownMenuItem>
          {api && (
            <>
              <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
                <Icon name="trash" size={15} />
                Excluir minha conta
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <Icon name="logout" size={15} />
                Sair
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {api && <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />}
      <BackupDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
