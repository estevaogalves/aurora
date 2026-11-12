import { usePrivacyStore } from "../lib/privacy";

/** Faixa no topo da tela enquanto os valores estão escondidos: explica o que está acontecendo e desfaz com um clique. */
export default function PrivacyBanner() {
  const hidden = usePrivacyStore((s) => s.hidden);
  const setHidden = usePrivacyStore((s) => s.setHidden);
  if (!hidden) return null;
  return (
    <p role="status" className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2 text-[13px] text-ink2">
      <span><b className="text-foreground">Modo privacidade ligado:</b> os valores em R$ estão escondidos nesta tela (relatórios exportados não mudam).</span>
      <button type="button" onClick={() => setHidden(false)} className="font-bold text-primary hover:underline">Mostrar valores</button>
    </p>
  );
}
