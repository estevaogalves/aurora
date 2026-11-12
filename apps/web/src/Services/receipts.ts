import { MAX_RECEIPT_BYTES, cleanFileName, receiptMimeOf } from "@/domain/receipts";
import { downloadBlob } from "./download";

export type PreparedReceipt = { ok: true; name: string; data: ArrayBuffer } | { ok: false; error: string };

/** Reduz uma imagem (foto do celular, por exemplo) até caber no limite: redimensiona e salva como JPEG. null se não deu. */
async function shrinkImage(file: File): Promise<ArrayBuffer | null> {
  try {
    const bitmap = await createImageBitmap(file);
    for (const [maxSide, quality] of [[1600, 0.82], [1280, 0.7], [1024, 0.6], [800, 0.5]] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff"; // fundo branco: PNG com transparência vira JPEG sem ficar preto
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_RECEIPT_BYTES) return await blob.arrayBuffer();
    }
  } catch {
    // formato que o navegador não abre: segue sem reduzir
  }
  return null;
}

/**
 * Confere o arquivo escolhido antes de anexar: o tipo vem dos primeiros bytes (só PNG, JPEG, WebP e PDF) e o tamanho
 * tem que caber em 300 KB. Imagem grande demais é reduzida sozinha; PDF grande demais é recusado.
 */
export async function prepareReceipt(file: File): Promise<PreparedReceipt> {
  const buffer = await file.arrayBuffer();
  const mime = receiptMimeOf(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)));
  if (!mime) return { ok: false, error: "Só são aceitos comprovantes em imagem (PNG, JPEG ou WebP) ou PDF." };
  if (buffer.byteLength <= MAX_RECEIPT_BYTES) return { ok: true, name: cleanFileName(file.name), data: buffer };
  if (mime === "application/pdf") return { ok: false, error: "O PDF passa de 300 KB. Envie uma versão menor." };
  const shrunk = await shrinkImage(file);
  if (!shrunk) return { ok: false, error: "A imagem passa de 300 KB e não deu para reduzi-la. Envie uma menor." };
  return { ok: true, name: cleanFileName(file.name).replace(/\.\w+$/, "") + ".jpg", data: shrunk };
}

/** Baixa o comprovante como arquivo (nunca o abre dentro do app). O tipo vem dos dados guardados. */
export function downloadReceiptFile(name: string, mime: string, data: ArrayBuffer) {
  downloadBlob(name, new Blob([data], { type: mime }));
}
