import { formatBRL } from "@/lib/money";
import { useHourInfo, useHoursText } from "@/Store/hours";

/** "≈ X h de trabalho" embaixo de um valor. Não aparece com o recurso desligado (padrão). */
export default function HoursHint({ cents }: { cents: number }) {
  const text = useHoursText()(cents);
  const { rate } = useHourInfo();
  if (!text) return null;
  // passar o mouse mostra a conta: valor ÷ valor da hora
  return <small title={`${formatBRL(cents)} ÷ ${formatBRL(Math.round(rate))} por hora de trabalho`} className="block text-right text-[11px] font-normal text-muted-foreground">{text} de trabalho</small>;
}
