import { Capacitor } from "@capacitor/core"

/** true quando o app roda empacotado no Android (Capacitor); false no navegador (web/PWA). */
export const isNative = (): boolean => Capacitor.isNativePlatform()

/** Onde ficam os dados locais, para os textos da tela: "navegador" na web e "aparelho" no app Android. */
export const placeWord = (): string => (isNative() ? "aparelho" : "navegador")
