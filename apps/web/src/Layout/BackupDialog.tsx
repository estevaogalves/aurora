import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/Features/Warnings/toast";
import type { FinanceData } from "@/domain/types";
import { describeBackup, parseBackup } from "@/Services/backup";
import { useFinanceStore } from "@/Store/FinanceStore";

/** Escolhe um arquivo de backup, mostra o que tem nele e só troca os dados depois da confirmação. */
export default function BackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const replaceAll = useFinanceStore((s) => s.replaceAll);
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setBackup(null);
    setError("");
    onClose();
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBackup(null);
    // um backup é pequeno; um arquivo grande assim não é do Aurora
    if (file.size > 20 * 1024 * 1024) return setError("Este arquivo é grande demais para ser um backup do Aurora.");
    const parsed = parseBackup(await file.text());
    if (!parsed) return setError("Este arquivo não é um backup do Aurora (ou foi gerado por uma versão mais nova do app).");
    setBackup(parsed);
  };

  const restore = async () => {
    if (!backup) return;
    setBusy(true);
    try {
      await replaceAll(backup);
      showToast({ type: "success", text: "Backup restaurado." });
      setBusy(false);
      close();
    } catch {
      setBusy(false);
      setError("Não foi possível restaurar o backup. Seus dados atuais não foram alterados.");
    }
  };

  const items = backup ? describeBackup(backup) : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar backup</DialogTitle>
          <DialogDescription>Escolha um arquivo gerado por "Exportar backup". Os dados atuais deste app serão substituídos pelos do arquivo.</DialogDescription>
        </DialogHeader>

        <input ref={input} type="file" accept="application/json,.json" className="sr-only" aria-label="Arquivo de backup" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}>{backup ? "Escolher outro arquivo" : "Escolher arquivo"}</Button>

        {backup && (
          items.length === 0 ? (
            <p className="text-sm text-muted-foreground">O backup está vazio.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map(([label, n]) => (
                <li key={label} className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2.5 text-sm">
                  <span>{label}</span>
                  <span className="num font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )
        )}
        {error && <p role="alert" className="rounded-md border border-destructive bg-secondary px-3 py-2 text-[13px] text-destructive">{error}</p>}
        {backup && <p className="text-[13px] text-destructive">Tudo o que está no app agora será substituído. Se tiver dúvida, exporte um backup antes.</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void restore()} disabled={!backup || busy}>{busy ? "Restaurando..." : "Substituir os dados"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
