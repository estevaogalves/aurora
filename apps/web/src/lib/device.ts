/** Tela de toque (celular/tablet): ali o foco automático em um campo abriria o teclado de imediato. */
export const isTouchDevice = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/** Para o `autoFocus` dos campos: só foca sozinho onde não há teclado virtual. */
export const canAutoFocus = () => !isTouchDevice();
