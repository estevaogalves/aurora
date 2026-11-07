import { useState } from "react";

export interface Toast {
  id: string;
  type: "success" | "error";
  text: string;
}

let addToastHandler: ((toast: Toast) => void) | null = null;

export function showToast(toast: Omit<Toast, "id">) {
  addToastHandler?.({ ...toast, id: crypto.randomUUID() });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  addToastHandler = (toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3000);
  };

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-6 py-3 rounded-md text-foreground shadow-lg transform transition-all duration-500 ${
            toast.type === "success" ? "bg-primary text-lg font-bold" : "bg-destructive text-lg font-bold"
          } animate-slide-in`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}