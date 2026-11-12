import { useEffect } from "react";
import Icon from "../components/Icon";
import { btnClass } from "../components/shared/styles";
import { usePrivacyStore } from "../lib/privacy";

/** Botão (e atalho Alt+P) que esconde ou mostra os valores em R$ na tela. */
export default function PrivacyToggle() {
  const hidden = usePrivacyStore((s) => s.hidden);
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hidden ? "Mostrar valores" : "Esconder valores"}
      aria-pressed={hidden}
      title={hidden ? "Mostrar valores (Alt+P)" : "Esconder valores (Alt+P)"}
      className={`${btnClass.base} ${btnClass.icon} ${hidden ? "!border-primary !text-primary" : ""}`}
    >
      <Icon name={hidden ? "eyeOff" : "eye"} size={16} />
    </button>
  );
}
