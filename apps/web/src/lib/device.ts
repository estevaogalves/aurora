import { isNative } from "../platform";

/** Tela de toque (celular/tablet): ali o foco automático em um campo abriria o teclado de imediato. No app Android é sempre toque (a WebView do emulador chegou a reportar `pointer: fine`). */
export const isTouchDevice = () =>
  isNative() || (typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);

/** Para o `autoFocus` dos campos: só foca sozinho onde não há teclado virtual. */
export const canAutoFocus = () => !isTouchDevice();
