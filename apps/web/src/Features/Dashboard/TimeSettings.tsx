import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { useHourRate } from "@/Store/hours";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { usePrefsStore } from "@/lib/preferences";

/** Ajustes de "tempo": equivalência das despesas em horas de trabalho e o card Dias de fôlego. Ficam só neste navegador. */
export default function TimeSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Tempo e fôlego</DialogTitle>
          <DialogDescription>Dois jeitos opcionais de enxergar seus números. Não mudam nenhum valor, só como a tela mostra.</DialogDescription>
        </DialogHeader>
        {open && <Fields onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Fields({ onClose }: { onClose: () => void }) {
  const prefs = usePrefsStore();
  const rateNow = useHourRate();
  const [showHours, setShowHours] = useState(prefs.showHours);
  const [showBreathing, setShowBreathing] = useState(prefs.showBreathing);
  const [hours, setHours] = useState(String(prefs.hoursPerMonth));
  const [income, setIncome] = useState(prefs.netIncome ? centsToInput(prefs.netIncome) : "");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0 || h > 744) return setError("Informe as horas de trabalho por mês, entre 1 e 744.");
    const net = income.trim() ? parseBRL(income) : null;
    if (income.trim() && (net === null || net <= 0)) return setError("A renda líquida precisa ser um valor maior que zero (ou deixe vazio para usar a renda do mês).");
    usePrefsStore.getState().setPrefs({ showHours, showBreathing, hoursPerMonth: h, netIncome: net });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <input type="checkbox" checked={showHours} onChange={(e) => setShowHours(e.target.checked)} />
        Ver as despesas em horas de trabalho
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Horas de trabalho por mês" htmlFor="tm-hours">
          <input id="tm-hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9,.]/g, ""))} className={inputClass} />
        </Field>
        <Field label="Renda líquida base" hint="(vazio = renda do mês)" htmlFor="tm-income">
          <MoneyInput id="tm-income" value={income} onChange={setIncome} placeholder="Ex.: 3.500,00" />
        </Field>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Valor da hora = renda líquida ÷ horas do mês.{" "}
        {rateNow > 0 ? <>Hoje: <b className="num text-foreground">{formatBRL(Math.round(rateNow))}</b> por hora.</> : "Sem renda no mês e sem renda base, não há como calcular."}
      </p>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <input type="checkbox" checked={showBreathing} onChange={(e) => setShowBreathing(e.target.checked)} />
        Mostrar o card “Dias de fôlego” no Painel
      </label>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
