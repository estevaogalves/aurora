import { useRef, useState } from "react";
import { Field } from "@/components/shared/FormFields";
import { MAX_RECEIPTS_PER_TRANSACTION, MAX_RECEIPT_BYTES, RECEIPT_ACCEPT, RECEIPT_WARNING, formatFileSize } from "@/domain";
import { downloadReceiptFile, prepareReceipt } from "@/Services/receipts";
import { useFinanceStore } from "@/Store/FinanceStore";
import { showToast } from "@/Features/Warnings/toast";

/** Comprovantes (imagem ou PDF, até 300 KB e 5 por lançamento) de uma despesa ou renda já salva. Só anexos: não mudam valores. */
export default function ReceiptsField({ transactionId }: { transactionId: string }) {
  const all = useFinanceStore((s) => s.receipts);
  const attach = useFinanceStore((s) => s.attachReceipt);
  const remove = useFinanceStore((s) => s.removeReceipt);
  const load = useFinanceStore((s) => s.loadReceipt);
  const receipts = all.filter((r) => r.transactionId === transactionId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    const prepared = await prepareReceipt(file);
    const failure = prepared.ok ? await attach(transactionId, { name: prepared.name, data: prepared.data }) : prepared.error;
    setBusy(false);
    if (failure) setError(failure);
    else showToast({ type: "success", text: "Comprovante anexado" });
  }

  async function download(id: string) {
    try {
      const { meta, data } = await load(id);
      downloadReceiptFile(meta.name, meta.mime, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível baixar o comprovante.");
    }
  }

  return (
    <Field label="Comprovantes" hint={`(opcional · imagem ou PDF até ${formatFileSize(MAX_RECEIPT_BYTES)}, no máximo ${MAX_RECEIPTS_PER_TRANSACTION})`} htmlFor={`receipt-${transactionId}`}>
      {receipts.length > 0 && (
        <ul className="mb-2 flex flex-col divide-y divide-border rounded-md border border-border px-3">
          {receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
              <span className="min-w-0 break-words font-semibold">{r.name} <span className="font-normal text-muted-foreground">· {formatFileSize(r.size)}</span></span>
              <span className="flex gap-3">
                <button type="button" onClick={() => void download(r.id)} className="font-bold text-primary hover:underline">Baixar</button>
                <button type="button" onClick={() => remove(r.id)} className="font-semibold text-muted-foreground hover:text-destructive hover:underline">Remover</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        id={`receipt-${transactionId}`}
        type="file"
        accept={RECEIPT_ACCEPT}
        disabled={busy || receipts.length >= MAX_RECEIPTS_PER_TRANSACTION}
        onChange={(e) => void pick(e.target.files?.[0])}
        className="block w-full text-[13px] file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-card file:px-3 file:py-1.5 file:text-[13px] file:font-semibold"
      />
      <p className="mt-1 text-xs text-muted-foreground">{RECEIPT_WARNING}</p>
      {error && <p role="alert" className="mt-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
    </Field>
  );
}
