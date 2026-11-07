/** Baixa um texto como arquivo. O BOM no CSV faz o Excel ler os acentos certo. */
export function downloadText(filename: string, content: string, mime: string, withBom = false) {
  const blob = new Blob([withBom ? "﻿" : "", content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
