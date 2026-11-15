import { App } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"
import { initSharedFile } from "./sharedFile"

/** Algo aberto por cima da tela (janela, lista de seleção, menu) que o botão voltar deve fechar antes de sair. */
const OPEN_LAYER = '[role="dialog"], [role="listbox"], [role="menu"]'

/** Ajustes que só valem no app Android: cor da barra de status e botão "voltar" do sistema. */
export async function initNative() {
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#0D1017" })
  } catch {
    // sem a barra de status (ou plugin indisponível): o app segue normalmente
  }
  void initSharedFile()
  // Voltar: 1º fecha o que estiver aberto por cima (o Radix fecha com Esc); 2º volta no histórico; na primeira tela, fecha o app.
  await App.addListener("backButton", ({ canGoBack }) => {
    if (document.querySelector(OPEN_LAYER)) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }))
    } else if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}
