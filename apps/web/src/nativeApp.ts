import { App } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"

/** Ajustes que só valem no app Android: cor da barra de status e botão "voltar" do sistema. */
export async function initNative() {
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#0D1017" })
  } catch {
    // sem a barra de status (ou plugin indisponível): o app segue normalmente
  }
  // Voltar navega no histórico; na primeira tela, fecha o app em vez de ficar parado.
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}
