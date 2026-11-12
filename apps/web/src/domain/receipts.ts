/**
 * Comprovantes (imagem ou PDF) anexados a um lançamento. Arquivos pequenos: até 300 KB e 5 por lançamento. O tipo vem
 * sempre dos primeiros bytes do arquivo (nunca do nome nem do tipo que o navegador informa); SVG e HTML não são aceitos
 * porque podem executar código. Só anexos: nada aqui muda valor, saldo, projeção ou relatório.
 */
export const MAX_RECEIPT_BYTES = 300 * 1024;
export const MAX_RECEIPTS_PER_TRANSACTION = 5;
export const RECEIPT_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";
export const RECEIPT_WARNING = "Anexe só o que for preciso: evite RG, CPF, CNH, número de cartão e outros documentos pessoais.";

export type ReceiptMime = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

/** Tipo pelos primeiros bytes: PNG, JPEG, WebP ou PDF; null se for outra coisa. */
export function receiptMimeOf(bytes: Uint8Array): ReceiptMime | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

/** "182 KB", "1,2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Nome do arquivo seguro para mostrar e baixar: sem caminho, sem caracteres de controle, até 80 letras. */
export function cleanFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  return cleaned || "comprovante";
}
