import { Capacitor } from "@capacitor/core"

/** true quando o app roda empacotado no Android (Capacitor); false no navegador (web/PWA). */
export const isNative = (): boolean => Capacitor.isNativePlatform()
