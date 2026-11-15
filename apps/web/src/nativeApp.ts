import { App } from "@capacitor/app"
import { registerPlugin } from "@capacitor/core"
import { initSharedFile } from "./sharedFile"
import { useThemeStore, type Theme } from "./theme/theme"

/** Algo aberto por cima da tela (janela, lista de seleção, menu) que o botão voltar deve fechar antes de sair. */
const OPEN_LAYER = '[role="dialog"], [role="listbox"], [role="menu"]'

/** Plugin nativo `SystemBarsPlugin`: cor das barras do sistema e do fundo atrás do app. */
const SystemBars = registerPlugin<{ set(options: { color: string; light: boolean }): Promise<void> }>("SystemBars")

/** Mesmas cores de fundo do tema do app (--background em index.css). */
const BAR_COLOR: Record<Theme, string> = { dark: "#0D1017", light: "#EFF1F8" }

function applyBars(theme: Theme) {
  // sem o plugin (ou com erro), as barras ficam como estão
  SystemBars.set({ color: BAR_COLOR[theme], light: theme === "light" }).catch(() => {})
}

/** Ajustes que só valem no app Android: barras do sistema acompanhando o tema e botão "voltar" do sistema. */
export async function initNative() {
  applyBars(useThemeStore.getState().theme)
  useThemeStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) applyBars(state.theme)
  })
  void initSharedFile()
  // Voltar: 1º fecha o que estiver aberto por cima (o Radix fecha com Esc); 2º volta no histórico; na primeira tela, fecha o app.
  await App.addListener("backButton", ({ canGoBack }) => {
    if (document.querySelector(OPEN_LAYER)) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }))
    } else if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}
