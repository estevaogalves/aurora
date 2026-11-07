import { useState, type ReactNode } from "react";

export interface Tip {
  x: number;
  y: number;
  title: string;
  body: ReactNode;
}

export function useChartTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: React.PointerEvent, title: string, body: ReactNode) =>
    setTip({ x: e.clientX, y: e.clientY, title, body });
  const hide = () => setTip(null);
  return { tip, show, hide };
}
