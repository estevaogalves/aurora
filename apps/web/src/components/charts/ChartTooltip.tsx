import type { Tip } from "./useChartTip";

/** Tooltip flutuante do protótipo (invertido: escuro no claro, claro no escuro). Vira para o outro lado perto da borda. */
export function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const flipX = tip.x > window.innerWidth * 0.6;
  const flipY = tip.y > window.innerHeight * 0.7;

  return (
    <div
      style={{
        left: tip.x + (flipX ? -14 : 14),
        top: tip.y + (flipY ? -14 : 14),
        transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
      }}
      className="pointer-events-none fixed z-[60] max-w-[240px] rounded-lg bg-foreground px-2.5 py-2 text-[12.5px] leading-snug text-background shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
    >
      <b className="mb-0.5 block">{tip.title}</b>
      {tip.body}
    </div>
  );
}
