import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/Store/UiStore";
import { formatEntry, keyFromEvent, type CalcKey } from "./calc";

/** Atributo que marca a calculadora: o "Lançar" usa para saber se o Esc veio dela. */
export const CALCULATOR_ATTR = "data-calculator";

type KeyDef = { key: CalcKey; label: string; aria: string; kind: "digit" | "op" | "fn" | "equals" };

const KEYS: KeyDef[] = [
  { key: "C", label: "C", aria: "Limpar", kind: "fn" },
  { key: "back", label: "⌫", aria: "Apagar", kind: "fn" },
  { key: "%", label: "%", aria: "Porcentagem", kind: "fn" },
  { key: "/", label: "÷", aria: "Dividir", kind: "op" },
  { key: "7", label: "7", aria: "7", kind: "digit" },
  { key: "8", label: "8", aria: "8", kind: "digit" },
  { key: "9", label: "9", aria: "9", kind: "digit" },
  { key: "*", label: "×", aria: "Multiplicar", kind: "op" },
  { key: "4", label: "4", aria: "4", kind: "digit" },
  { key: "5", label: "5", aria: "5", kind: "digit" },
  { key: "6", label: "6", aria: "6", kind: "digit" },
  { key: "-", label: "−", aria: "Subtrair", kind: "op" },
  { key: "1", label: "1", aria: "1", kind: "digit" },
  { key: "2", label: "2", aria: "2", kind: "digit" },
  { key: "3", label: "3", aria: "3", kind: "digit" },
  { key: "+", label: "+", aria: "Somar", kind: "op" },
  { key: "neg", label: "±", aria: "Trocar sinal", kind: "fn" },
  { key: "0", label: "0", aria: "0", kind: "digit" },
  { key: ",", label: ",", aria: "Vírgula", kind: "digit" },
  { key: "=", label: "=", aria: "Resultado", kind: "equals" },
];

const keyClass: Record<KeyDef["kind"], string> = {
  digit: "bg-secondary text-foreground hover:bg-border",
  fn: "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground",
  op: "bg-primary/15 text-primary hover:bg-primary/25",
  equals: "bg-primary text-primary-foreground hover:brightness-110",
};

/**
 * Card da calculadora. O estado fica na UiStore, então a conta continua a mesma quando o card muda de
 * lugar (flutuante na tela ou ao lado do formulário "Lançar"). O botão X fecha só a calculadora.
 * O teclado funciona quando o foco está no card, sem atrapalhar a digitação nos campos do formulário.
 */
export default function Calculator({ autoFocus = false, className, dragHandle }: { autoFocus?: boolean; className?: string; dragHandle?: React.HTMLAttributes<HTMLElement> }) {
  const calc = useUiStore((s) => s.calc);
  const press = useUiStore((s) => s.pressCalc);
  const closeCalc = useUiStore((s) => s.closeCalc);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) card.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      return closeCalc();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Enter e espaço em um botão focado já o acionam; só o teclado numérico do card é tratado aqui
    if ((e.key === "Enter" || e.key === " ") && e.target instanceof HTMLButtonElement) return;
    const key = keyFromEvent(e.key);
    if (!key) return;
    e.preventDefault();
    press(key);
  }

  return (
    <div
      {...{ [CALCULATOR_ATTR]: "" }}
      ref={card}
      tabIndex={-1}
      role="group"
      aria-label="Calculadora"
      onKeyDown={onKeyDown}
      className={cn("flex w-full flex-col gap-3 rounded-lg border border-border-strong bg-card p-3.5 text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <div className="flex items-center justify-between gap-2">
        {/* com `dragHandle`, o título é a alça para arrastar a calculadora */}
        <span
          {...dragHandle}
          className={cn("flex items-center gap-2 font-display text-[15px] font-semibold", dragHandle && "min-w-0 flex-1 cursor-grab touch-none select-none active:cursor-grabbing")}
          title={dragHandle ? "Arraste para mover (duplo clique volta ao canto)" : undefined}
        >
          <Icon name="calc" size={16} />
          Calculadora
          {dragHandle && <span aria-hidden className="ml-auto pr-1 text-muted-foreground">⠿</span>}
        </span>
        <button
          type="button"
          onClick={closeCalc}
          aria-label="Fechar calculadora"
          title="Fechar calculadora"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="rounded-md bg-secondary px-3 py-2 text-right" aria-live="polite">
        <div className="num h-4 truncate text-xs text-muted-foreground" data-testid="calc-history">{calc.history}</div>
        <output className="num block truncate text-2xl font-bold" data-testid="calc-display">{formatEntry(calc.entry)}</output>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-label={k.aria}
            onClick={() => press(k.key)}
            className={cn("num min-h-11 rounded-md text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring", keyClass[k.kind])}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const MARGIN = 8;

/**
 * Calculadora solta na tela, para quando o "Lançar" está fechado. Dá para arrastá-la pelo título e
 * deixá-la onde quiser; duplo clique no título a devolve ao canto. Dentro do "Lançar" ela aparece ao lado do formulário.
 */
export function FloatingCalculator() {
  const open = useUiStore((s) => s.calcOpen);
  const launchOpen = useUiStore((s) => s.launchOpen);
  const pos = useUiStore((s) => s.calcPos);
  const setPos = useUiStore((s) => s.setCalcPos);
  const box = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const clamp = (x: number, y: number) => {
    const w = box.current?.offsetWidth ?? 272;
    const h = box.current?.offsetHeight ?? 360;
    return {
      x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    };
  };

  // ao redimensionar a janela, a calculadora não pode ficar para fora da tela
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos(clamp(pos.x, pos.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  if (!open || launchOpen) return null;

  const handle: React.HTMLAttributes<HTMLElement> = {
    onPointerDown: (e) => {
      if (e.button !== 0 || !box.current) return;
      const rect = box.current.getBoundingClientRect();
      grab.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (grab.current) setPos(clamp(e.clientX - grab.current.dx, e.clientY - grab.current.dy));
    },
    onPointerUp: (e) => {
      grab.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onDoubleClick: () => setPos(null),
  };

  return (
    <div
      ref={box}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={cn(
        "fixed z-40 w-[min(272px,calc(100vw-2rem))] shadow-[0_16px_40px_rgba(0,0,0,0.3)]",
        !pos && "bottom-[84px] right-4 min-[701px]:bottom-6 min-[701px]:right-6",
      )}
    >
      <Calculator autoFocus dragHandle={handle} />
    </div>
  );
}
