import { useState } from "react";
import { Field, inputClass } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/Store/AuthStore";

/** Pede a senha e exclui a conta com todos os dados (LGPD: direito de eliminação). */
export default function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível excluir a conta. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir minha conta</DialogTitle>
          <DialogDescription>
            Isso apaga permanentemente sua conta e todos os seus dados (lançamentos, metas, anotações). Não há como desfazer.
            Se quiser uma cópia, use antes "Exportar meus dados".
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Confirme sua senha" htmlFor="delete-account-password">
            <input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || password.length === 0}>
              {busy ? "Excluindo..." : "Excluir conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
