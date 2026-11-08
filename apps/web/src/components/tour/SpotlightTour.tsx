import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { btnClass } from "@/components/shared/styles";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/Layout/navigation";
import { useUiStore } from "@/Store/UiStore";
import { computePlacement, type Box, type Placement } from "./placement";
import { findTarget, isUsable, stepKey, type TourStep } from "./types";

const PAD = 8;
/** Acima disso, o progresso vira uma barra (os pontos não cabem no cartão). */
const MAX_DOTS = 12;
/** Quanto esperar (ms) o elemento de outra aba aparecer antes de pular a etapa. */
const ROUTE_WAIT_MS = 2000;

interface Props {
  steps: TourStep[];
  /** concluiu (Finalizar) ou saiu antes (X, Pular tour ou Esc) */
  onEnd: (state: "done" | "dismissed") => void;
}

/**
 * Tour com spotlight: escurece a tela, destaca um elemento por vez com um halo
 * e mostra um cartão ao lado. Bloqueia cliques e rolagem da página enquanto está aberto.
 * Etapas com `route` levam o usuário até a aba antes de destacar o elemento; as que não aparecem são puladas.
 */
export default function SpotlightTour({ steps, onEnd }: Props) {
  const navigate = useNavigate();
  const [list, setList] = useState(steps);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<Element | null>(document.activeElement);
  const direction = useRef(1);
  const scrolledFor = useRef("");
  const waiting = useRef<{ key: string; since: number } | null>(null);

  const step = list[index];
  const key = stepKey(step);
  // primeira etapa de outra tela: o cartão avisa que a apresentação mudou de aba
  const newScreen = index > 0 && step.route && list[index - 1].route !== step.route ? NAV_ITEMS.find((n) => n.path === step.route)?.label : undefined;
  const last = index === list.length - 1;
  const total = list.length;

  const next = useCallback(() => {
    direction.current = 1;
    if (last) onEnd("done");
    else setIndex((i) => i + 1);
  }, [last, onEnd]);
  const prev = useCallback(() => {
    direction.current = -1;
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // enquanto o tour está aberto, as telas sem dados do usuário mostram exemplos
  useLayoutEffect(() => {
    const { setTourDemo } = useUiStore.getState();
    setTourDemo(true);
    return () => setTourDemo(false);
  }, []);

  // etapa de outra aba: leva o usuário até ela
  useEffect(() => {
    if (step.route && window.location.pathname !== step.route) navigate(step.route);
  }, [step.route, key, navigate]);

  /** Tira da lista a etapa cujo elemento não existe e segue na direção em que o usuário vinha. */
  const drop = useCallback(() => {
    if (list.length <= 1 || (direction.current > 0 && index >= list.length - 1)) return onEnd("done");
    setList((l) => l.filter((_, i) => i !== index));
    if (direction.current < 0) setIndex((i) => Math.max(0, i - 1));
  }, [list.length, index, onEnd]);

  /** Mede o elemento da etapa. Devolve true se vale tentar de novo (a aba ainda está carregando). */
  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!isUsable(el)) {
      if (step.route) {
        const w = waiting.current?.key === key ? waiting.current : (waiting.current = { key, since: Date.now() });
        if (Date.now() - w.since < ROUTE_WAIT_MS) return true;
      }
      drop();
      return false;
    }
    waiting.current = null;
    // ao trocar de etapa: traz o elemento para a tela
    if (scrolledFor.current !== key) {
      scrolledFor.current = key;
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
      el.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest" });
    }
    const r = el.getBoundingClientRect();
    setRect({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    return false;
  }, [step.target, step.route, key, drop]);

  // mede o elemento (uma vez por quadro) ao trocar de etapa e acompanha rolagem e redimensionamento
  useEffect(() => {
    let raf = 0;
    let retry = 0;
    let observed: HTMLElement | null = null;
    const observer = new ResizeObserver(() => schedule());
    function run() {
      const again = measure();
      const el = findTarget(step.target);
      if (isUsable(el) && el !== observed) {
        observer.disconnect();
        observer.observe(el);
        observed = el;
      }
      if (again) retry = window.setTimeout(schedule, 100);
    }
    function schedule() {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      raf = requestAnimationFrame(run);
    }
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer.disconnect();
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
        {newScreen && (
          <p role="status" className="mx-4 mt-3 rounded-md bg-primary/10 px-3 py-1.5 text-[12.5px] font-semibold text-primary">
            Agora vamos falar da tela {newScreen}
          </p>
        )}
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
          {total > MAX_DOTS ? (
            <div className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-border-strong" aria-hidden="true">
              <i className="block h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>
          ) : (
            <div className="flex gap-[5px]" aria-hidden="true">
              {list.map((s, i) => (
                <i key={stepKey(s)} className={cn("h-[7px] rounded-full transition-all", i === index ? "w-5 bg-primary" : i < index ? "w-[7px] bg-primary/50" : "w-[7px] bg-border-strong")} />
              ))}
            </div>
          )}
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
