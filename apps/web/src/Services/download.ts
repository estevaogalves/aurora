/** Entrega um blob como arquivo. A URL fica viva por um tempo: no celular o download começa depois do clique. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Baixa um texto como arquivo. O BOM no CSV faz o Excel ler os acentos certo. */
export function downloadText(filename: string, content: string, mime: string, withBom = false) {
  downloadBlob(filename, new Blob([withBom ? "﻿" : "", content], { type: `${mime};charset=utf-8` }));
}
