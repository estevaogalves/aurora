import { registerPlugin } from "@capacitor/core"
import type { PluginListenerHandle } from "@capacitor/core"
import { showToast } from "@/Features/Warnings/toast"
import { IMPORT_MAX_BYTES } from "@/domain/csvImport"
import { useUiStore } from "@/Store/UiStore"

/** Arquivo enviado ao Aurora por "Compartilhar" ou "Abrir com" (plugin nativo `SharedFilePlugin`, só no app Android). */
interface Pending {
  has: boolean
  name?: string
  mime?: string
  /** conteúdo em base64 */
  data?: string
  tooLarge?: boolean
  error?: boolean
}

interface SharedFilePlugin {
  getPending(): Promise<Pending>
  addListener(event: "sharedFile", listener: () => void): Promise<PluginListenerHandle>
}

const SharedFile = registerPlugin<SharedFilePlugin>("SharedFile")

function toFile(name: string, base64: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name)
}

/** Busca o arquivo recebido (se houver) e abre a importação com ele já escolhido. */
async function take() {
  let pending: Pending
  try {
    pending = await SharedFile.getPending()
  } catch {
    return
  }
  if (!pending.has) return
  if (pending.tooLarge) return showToast({ type: "error", text: `O arquivo passa de ${IMPORT_MAX_BYTES / 1024 / 1024} MB. Divida o extrato em períodos menores.` })
  if (pending.error || !pending.data) return showToast({ type: "error", text: "Não consegui ler o arquivo recebido. Baixe-o e escolha pelo Importar." })
  useUiStore.getState().openImportWith(toFile(pending.name || "arquivo", pending.data))
}

/** Liga o recebimento de arquivos: o que chegou com o app fechado e o que chega com ele aberto. */
export async function initSharedFile() {
  try {
    await SharedFile.addListener("sharedFile", () => void take())
    await take()
  } catch {
    // plugin indisponível: o Importar normal continua valendo
  }
}
