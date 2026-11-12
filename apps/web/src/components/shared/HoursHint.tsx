import { useHoursText } from "@/Store/hours";

/** "≈ X h de trabalho" embaixo de um valor. Não aparece com o recurso desligado (padrão). */
export default function HoursHint({ cents }: { cents: number }) {
  const text = useHoursText()(cents);
  if (!text) return null;
  return <small className="block text-right text-[11px] font-normal text-muted-foreground">{text} de trabalho</small>;
}
