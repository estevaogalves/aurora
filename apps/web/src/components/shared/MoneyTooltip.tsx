import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findMoneyToken, parseMoneyToken } from "@/lib/moneyHover";
import { describeMoney } from "@/lib/moneyWords";

/** Quanto o mouse precisa ficar parado sobre o valor para o balão aparecer. */
const HOVER_DELAY_MS = 450;
/** Folga (px) em volta do valor em que o mouse ainda conta como "em cima". */
const SLACK = 3;

interface Shown {
  lines: string[];
  /** retângulos do valor, para posicionar o balão e saber quando o mouse saiu */
  rects: DOMRect[];
  x: number;
  y: number;
  below: boolean;
}

/** Texto (e posição nele) sob o ponto, pelas APIs de caret do navegador. */
function textAt(x: number, y: number): { node: Text; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode.nodeType === Node.TEXT_NODE) return { node: pos.offsetNode as Text, offset: pos.offset };
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range?.startContainer.nodeType === Node.TEXT_NODE) return { node: range.startContainer as Text, offset: range.startOffset };
  }
  return null;
}

const inside = (rects: DOMRect[], x: number, y: number) =>
  rects.some((r) => x >= r.left - SLACK && x <= r.right + SLACK && y >= r.top - SLACK && y <= r.bottom + SLACK);

/** O valor em dinheiro sob o ponto (se houver) e o que o balão deve dizer sobre ele. */
function moneyAt(x: number, y: number): Shown | null {
  const hit = textAt(x, y);
  if (!hit) return null;
  const token = findMoneyToken(hit.node.data, hit.offset);
  if (!token) return null;

  const range = document.createRange();
  range.setStart(hit.node, token.start);
  range.setEnd(hit.node, token.end);
  const rects = [...range.getClientRects()];
  if (!inside(rects, x, y)) return null;

  const parts = parseMoneyToken(token.text);
  const lines = parts ? describeMoney(parts) : [];
  if (lines.length === 0) return null;

  const box = range.getBoundingClientRect();
  const below = box.top < 90; // sem espaço em cima: o balão vai para baixo
  return { lines, rects, x: box.left + box.width / 2, y: below ? box.bottom : box.top, below };
}

/**
 * Balão global que diz o valor por extenso ao manter o mouse sobre qualquer valor em dinheiro ("R$ 110,00" ->
 * "cento e dez reais"; valores enormes também ganham a forma abreviada, "R$ 2 bi 1 mi"). Lê o texto que a tela já
 * mostra, então vale para qualquer tela, frase, gráfico ou diálogo. Só ajuda a ler: não muda nem guarda nada.
 */
export default function MoneyTooltip() {
  const [shown, setShown] = useState<Shown | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const hide = () => {
      window.clearTimeout(timer.current);
      if (shownRef.current) {
        shownRef.current = null;
        setShown(null);
      }
    };

    const onMove = (e: MouseEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      // enquanto o mouse segue em cima do mesmo valor, o balão fica
      if (shownRef.current && inside(shownRef.current.rects, e.clientX, e.clientY)) return;
      hide();
      timer.current = window.setTimeout(() => {
        const next = moneyAt(pointer.current.x, pointer.current.y);
        if (next) {
          shownRef.current = next;
          setShown(next);
        }
      }, HOVER_DELAY_MS);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      hide();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", hide, true);
      document.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);

  if (!shown) return null;
  const [first, ...rest] = shown.lines;
  // o balão acompanha o valor, sem passar das bordas da janela
  const half = 160;
  const left = Math.min(Math.max(shown.x, half + 8), window.innerWidth - half - 8);

  return createPortal(
    <div
      role="tooltip"
      data-money-tooltip
      style={{ left, top: shown.y, transform: `translate(-50%, ${shown.below ? "8px" : "calc(-100% - 8px)"})` }}
      className="pointer-events-none fixed z-[200] w-max max-w-[320px] rounded-md border border-border-strong bg-card px-3 py-2 text-card-foreground shadow-lg"
    >
      <p className="break-words text-[13px] font-semibold leading-snug">{first}</p>
      {rest.map((line) => (
        <p key={line} className="num mt-0.5 break-words text-[12px] text-muted-foreground">{line}</p>
      ))}
    </div>,
    document.body,
  );
}
