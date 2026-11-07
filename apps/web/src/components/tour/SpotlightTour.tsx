import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btnClass } from "@/components/shared/styles";
import { cn } from "@/lib/utils";
import { computePlacement, type Box, type Placement } from "./placement";
import { findTarget, isUsable, type TourStep } from "./types";

const PAD = 8;

interface Props {
  steps: TourStep[];
  /** concluiu (Finalizar) ou saiu antes (X, Pular tour ou Esc) */
  onEnd: (state: "done" | "dismissed") => void;
}

/**
 * Tour com spotlight: escurece a tela, destaca um elemento por vez com um halo
 * e mostra um cartão ao lado. Bloqueia cliques e rolagem da página enquanto está aberto.
 */
export default function SpotlightTour({ steps, onEnd }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<Element | null>(document.activeElement);

  const step = steps[index];
  const last = index === steps.length - 1;
  const total = steps.length;

  const next = useCallback(() => (last ? onEnd("done") : setIndex((i) => i + 1)), [last, onEnd]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /** Mede o elemento da etapa. Se ele sumiu, pula para a próxima etapa que existir. */
  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!isUsable(el)) {
      if (index < steps.length - 1) setIndex(index + 1);
      else onEnd("done");
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step.target, index, steps.length, onEnd]);

  // ao trocar de etapa: traz o elemento para a tela
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    if (isUsable(el)) {
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
      el.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest" });
    }
  }, [step.target]);

  // mede o elemento (uma vez por quadro) ao trocar de etapa e acompanha rolagem e redimensionamento
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const el = findTarget(step.target);
    const observer = el ? new ResizeObserver(schedule) : null;
    if (el) observer?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
    };
  }, [measure, step.target]);

  // posiciona o cartão depois de saber o tamanho dele e o do destaque
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!rect || !card) return;
    setPlace(
      computePlacement({
        target: rect,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        prefer: step.placement,
      }),
    );
  }, [rect, step.placement, index]);

  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [index]);

  // devolve o foco para onde estava quando o tour fecha
  useEffect(() => {
    const previous = restoreFocus.current;
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  // a página por baixo não rola nem recebe toque
  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;
    const stop = (e: Event) => e.preventDefault();
    block.addEventListener("wheel", stop, { passive: false });
    block.addEventListener("touchmove", stop, { passive: false });
    return () => {
      block.removeEventListener("wheel", stop);
      block.removeEventListener("touchmove", stop);
    };
  }, []);

  // teclado: setas navegam, Esc fecha, Tab fica dentro do cartão
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEnd("dismissed");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Tab") {
        const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && at <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && at === items.length - 1) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onEnd]);

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-tour-layer>
      <div ref={blockRef} className="fixed inset-0" onClick={(e) => e.stopPropagation()} />
      {rect && <div className="tour-spot" aria-hidden="true" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={cn(
          "fixed z-[1] w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-border-strong bg-card text-card-foreground shadow-[0_18px_50px_rgb(0_0_0/0.45)]",
          !place && "invisible",
        )}
        style={{ left: place?.left ?? 0, top: place?.top ?? 0 }}
      >
        <div className="h-1 bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--k2)))]" />
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-0.5 px-4 pb-1.5 pt-3.5">
          <div className="num row-span-2 font-display text-[34px] font-semibold leading-none tracking-[-0.04em] text-primary" aria-label={`Etapa ${index + 1} de ${total}`}>
            {index + 1}
            <small className="text-[13px] font-medium tracking-normal text-muted-foreground">/{total}</small>
          </div>
          <h4 id="tour-title" className="mt-0.5 font-display text-[17px] font-semibold leading-tight [text-wrap:balance]">{step.title}</h4>
          <button type="button" aria-label="Fechar tour" onClick={() => onEnd("dismissed")} className="-mr-2 -mt-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <p id="tour-text" className="col-span-2 text-[13.5px] text-muted-foreground">{step.text}</p>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-3.5 pt-3">
          <div className="flex gap-[5px]" aria-hidden="true">
            {steps.map((s, i) => (
              <i key={s.target} className={cn("h-[7px] rounded-full transition-all", i === index ? "w-5 bg-primary" : i < index ? "w-[7px] bg-primary/50" : "w-[7px] bg-border-strong")} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={prev} disabled={index === 0} className={`${btnClass.base} ${btnClass.sm} disabled:pointer-events-none disabled:opacity-40`}>Voltar</button>
            <button ref={nextRef} type="button" onClick={next} className={`${btnClass.primary} ${btnClass.sm}`}>{last ? "Finalizar" : "Próximo"}</button>
          </div>
        </div>
        {!last && (
          <div className="px-4 pb-3 -mt-1">
            <button type="button" onClick={() => onEnd("dismissed")} className="text-[12.5px] font-semibold text-muted-foreground underline underline-offset-[3px] hover:text-foreground">Pular tour</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
