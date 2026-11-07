import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/http";
import { importLocalData } from "@/api/importData";
import Panel, { PageHeader } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { showToast } from "@/Features/Warnings/toast";
import type { FinanceData } from "@/domain/types";
import { useFinanceStore } from "@/Store/FinanceStore";
import { countRecords, dismissImport, hasLocalRecords, readLocalData } from "./localData";

const LABELS: [keyof ReturnType<typeof countRecords>, string][] = [
  ["transactions", "Lançamentos (rendas e despesas)"],
  ["credits", "Compras no crédito"],
  ["goals", "Metas"],
  ["extras", "Despesas extras"],
  ["notes", "Anotações"],
  ["categories", "Categorias próprias"],
];

/** Leva para a conta o que estava salvo só neste navegador. O original não é apagado. */
export default function ImportPage() {
  const navigate = useNavigate();
  const hydrate = useFinanceStore((s) => s.hydrate);
  const hasAccountData = useFinanceStore((s) => s.transactions.length + s.creditTransactions.length + s.goals.length + s.notes.length + s.extraExpenses.length > 0);
  const [local, setLocal] = useState<FinanceData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(hasAccountData);

  useEffect(() => {
    void readLocalData().then(setLocal);
  }, []);

  const run = async (replace: boolean) => {
    if (!local) return;
    setBusy(true);
    setError("");
    try {
      await importLocalData(local, replace);
      await hydrate();
      dismissImport();
      showToast({ type: "success", text: "Dados importados para a sua conta." });
      navigate("/painel", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      else setError(e instanceof ApiError ? e.message : "Não foi possível importar. Tente novamente.");
      setBusy(false);
    }
  };

  const counts = local ? countRecords(local) : null;
  const empty = local !== null && !hasLocalRecords(local);

  return (
    <>
      <PageHeader title="Importar dados" subtitle="Traga para a sua conta o que você já tinha salvo neste navegador." />
      <Panel title="Dados deste navegador" subtitle="Eles continuam aqui depois da importação, como cópia de segurança.">
        {!counts && <p className="text-muted-foreground">Lendo...</p>}
        {empty && <p className="text-muted-foreground">Não há dados salvos neste navegador.</p>}
        {counts && !empty && (
          <ul className="mb-5 grid gap-2 sm:grid-cols-2">
            {LABELS.filter(([key]) => counts[key] > 0).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2.5 text-sm">
                <span>{label}</span>
                <span className="num font-semibold">{counts[key]}</span>
              </li>
            ))}
          </ul>
        )}

        {conflict && !empty && (
          <p role="alert" className="mb-4 rounded-md border border-destructive bg-secondary px-3 py-2 text-[13px] text-destructive">
            Sua conta já tem dados. Importar agora vai <strong>substituir</strong> o que está na conta pelos dados deste navegador.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-destructive bg-secondary px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!empty && (
            <button type="button" disabled={busy || !local} onClick={() => run(conflict)} className={`${btnClass.primary} disabled:opacity-60`}>
              {busy ? "Importando..." : conflict ? "Substituir os dados da conta" : "Importar para a conta"}
            </button>
          )}
          <Link to="/painel" onClick={dismissImport} className={btnClass.base}>
            {empty ? "Voltar" : "Agora não"}
          </Link>
        </div>
      </Panel>
    </>
  );
}
