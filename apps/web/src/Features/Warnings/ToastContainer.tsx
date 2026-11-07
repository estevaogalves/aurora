import { useEffect, useState } from "react";
import { subscribeToasts, type Toast } from "./toast";

const DURATION_MS = 2600;

/** Avisos em pílula, no rodapé central (protótipo B). */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      subscribeToasts((toast) => {
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), DURATION_MS);
      }),
    [],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-lg ${
            toast.type === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
