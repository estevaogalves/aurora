import { Directory, Filesystem } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import { isNative } from "../platform"

/** Lê o blob como base64 (sem o prefixo `data:`), formato que o Filesystem do Capacitor espera. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o arquivo."))
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.readAsDataURL(blob)
  })
}

/** No app Android o `<a download>` não funciona na WebView: grava no cache e abre a folha de compartilhar (Salvar em Arquivos, Drive, WhatsApp...). */
async function shareBlob(filename: string, blob: Blob) {
  const file = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache })
  await Share.share({ title: filename, url: file.uri, dialogTitle: "Salvar ou enviar" })
}

/** Entrega um blob como arquivo. A URL fica viva por um tempo: no celular o download começa depois do clique. */
export function downloadBlob(filename: string, blob: Blob) {
  if (isNative()) {
    // cancelar a folha de compartilhar rejeita a promessa: não é erro para o usuário
    void shareBlob(filename, blob).catch(() => {})
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Baixa um texto como arquivo. O BOM no CSV faz o Excel ler os acentos certo. */
export function downloadText(filename: string, content: string, mime: string, withBom = false) {
  downloadBlob(filename, new Blob([withBom ? "﻿" : "", content], { type: `${mime};charset=utf-8` }))
}
