import { useEffect } from "react";
import { usePrivacyStore } from "./privacy";

/** Atalho Alt+P: esconde ou mostra os valores em R$. Não cria nenhum botão no cabeçalho (o controle fica no menu da conta). */
export function usePrivacyShortcut() {
  const toggle = usePrivacyStore((s) => s.toggle);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Alt+P (também com Shift ou Ctrl+Alt, que é o AltGr em alguns teclados); vale pela tecla física ou pela letra
      const isP = e.code === "KeyP" || e.key.toLowerCase() === "p" || e.key === "π" || e.key === "∏";
      if (!e.altKey || e.metaKey || !isP) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    // captura no documento: roda antes de qualquer tela ou diálogo que prenda o foco
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [toggle]);
}
