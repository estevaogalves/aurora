import { uuid } from "@/lib/uuid";
export interface Toast {
  id: string;
  type: "success" | "error";
  text: string;
}

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();

/** Mostra um aviso rápido na tela. */
export function showToast(toast: Omit<Toast, "id">) {
  const full: Toast = { ...toast, id: uuid() };
  listeners.forEach((listener) => listener(full));
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
