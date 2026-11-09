import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

/**
 * Popover de um mês escolhido no gráfico, ancorado em (left, top) dentro de `container`.
 * - tocar em outro mês do gráfico troca o conteúdo direto (o toque não conta como "clicar fora");
 * - rolar a página fecha o popover (rolar dentro dele não).
 */
export default function PickPopover({ container, left, top, onClose, children }: { container: RefObject<HTMLElement | null>; left: number; top: number; onClose: () => void; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && content.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [onClose]);

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor asChild>
        <span aria-hidden="true" className="pointer-events-none absolute h-px w-px" style={{ left, top }} />
      </PopoverAnchor>
      <PopoverContent
        ref={content}
        side="top"
        align="center"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && container.current?.contains(e.target)) e.preventDefault();
        }}
        className="w-[min(280px,calc(100vw-2rem))] select-none p-3 text-[13px]"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
