import { useEffect } from "react";
import { usePrivacyStore } from "./privacy";

/** Atalho Alt+P: esconde ou mostra os valores em R$. Não cria nenhum botão no cabeçalho (o controle fica no menu da conta). */
export function usePrivacyShortcut() {
  const toggle = usePrivacyStore((s) => s.toggle);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyP") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}
