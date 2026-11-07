import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { btnClass } from "@/components/shared/styles";
import { dismissImport, hasLocalRecords, importDismissed, readLocalData } from "@/Features/Auth/localData";
import { DATA_SOURCE } from "@/config";

/** Avisa, uma vez, que há dados salvos neste navegador que ainda não foram para a conta. */
export default function ImportBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (DATA_SOURCE !== "api" || importDismissed()) return;
    void readLocalData().then((d) => setShow(hasLocalRecords(d)));
  }, []);

  if (!show) return null;

  const close = () => {
    dismissImport();
    setShow(false);
  };

  return (
    <div role="status" className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1240px] flex-wrap items-center justify-between gap-3 rounded-lg border border-border-strong bg-card px-4 py-3 text-[13.5px]">
      <span>Encontramos dados salvos neste navegador. Quer levá-los para a sua conta?</span>
      <span className="flex gap-2">
        <Link to="/importar" onClick={() => setShow(false)} className={`${btnClass.primary} ${btnClass.sm}`}>
          Importar
        </Link>
        <button type="button" onClick={close} className={`${btnClass.base} ${btnClass.sm}`}>
          Agora não
        </button>
      </span>
    </div>
  );
}
