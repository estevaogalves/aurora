import { useMemo, useState } from "react";
import ChartLine from "@/components/charts/ChartLine";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import Panel, { Empty } from "@/components/shared/Panel";
import StatCard from "@/components/shared/StatCard";
import { averageMonthlyContribution, investedForIncome, parsePercent, passiveIncome, simulateGrowth, SIM_MAX_RATE, SIM_MAX_YEARS, yieldOnCost } from "@/domain";
import { centsToInput, formatBRL, formatBRLShort, parseBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { getCurrentMonth } from "@/Utils/Date";

/** Exemplos de taxa só para preencher o campo: não são promessa nem previsão, e podem ser trocados por qualquer valor. */
const RATE_EXAMPLES = [
  { label: "Renda fixa conservadora: 10% a.a.", rate: "10" },
  { label: "Dividendos: 6% a.a.", rate: "6" },
];

/**
 * Simulador de investimentos: juros compostos e renda passiva por dividendos, com a taxa que o usuário digitar.
 * Não grava nada, não usa nenhum dado externo e não é recomendação de investimento.
 */
export default function SimulatorView() {
  const investments = useFinanceStore((s) => s.investments);
  const movements = useFinanceStore((s) => s.investmentMovements);
  const average = useMemo(() => averageMonthlyContribution(investments, movements, getCurrentMonth()), [investments, movements]);

  // o aporte mensal começa com a média dos aportes registrados (se houver); tudo pode ser trocado
  const [monthly, setMonthly] = useState(average > 0 ? centsToInput(average) : "");
  const [initial, setInitial] = useState("");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("");
  const [yieldText, setYieldText] = useState("");
  const [dividends, setDividends] = useState("");

  const monthlyCents = parseBRL(monthly) ?? 0;
  const initialCents = parseBRL(initial) ?? 0;
  const yearsN = Number(years);
  const rateN = parsePercent(rate);
  const yieldN = parsePercent(yieldText);

  const result = useMemo(
    () => (rateN === null ? null : simulateGrowth({ initial: initialCents, monthly: monthlyCents, years: yearsN, annualRate: rateN })),
    [initialCents, monthlyCents, yearsN, rateN],
  );
  const empty = monthlyCents === 0 && initialCents === 0;

  let problem = "";
  if (!Number.isInteger(yearsN) || yearsN < 1 || yearsN > SIM_MAX_YEARS) problem = `O prazo vai de 1 a ${SIM_MAX_YEARS} anos.`;
  else if (rate.trim() && (rateN === null || rateN > SIM_MAX_RATE)) problem = `A rentabilidade vai de 0 a ${SIM_MAX_RATE}% ao ano.`;
  else if (yieldText.trim() && yieldN === null) problem = "O yield anual precisa ser um número, como 6 ou 6,5.";

  const income = result && yieldN !== null ? passiveIncome(result.final, yieldN) : null;
  const dividendsCents = parseBRL(dividends);
  const cost = result && dividendsCents !== null && dividends.trim() ? yieldOnCost(dividendsCents, result.invested) : null;
  const target = yieldN !== null && yieldN > 0 ? investedForIncome(100000, yieldN) : null;

  return (
    <div className="flex flex-col gap-3.5">
      <p role="note" className="rounded-md border border-border bg-secondary px-3.5 py-2.5 text-[13px] text-ink2">
        <b className="text-foreground">Simulação ilustrativa, não é recomendação de investimento.</b> O resultado depende só dos números que você digitar: nenhuma rentabilidade é garantida, e o Aurora não sugere taxas.
      </p>

      <Panel title="Simular o crescimento" subtitle="Juros compostos com aporte no fim de cada mês">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Aporte mensal" hint={average > 0 ? "(média dos seus aportes)" : undefined} htmlFor="sim-monthly">
            <MoneyInput id="sim-monthly" value={monthly} onChange={setMonthly} placeholder="500,00" />
          </Field>
          <Field label="Valor inicial" hint="(opcional)" htmlFor="sim-initial">
            <MoneyInput id="sim-initial" value={initial} onChange={setInitial} placeholder="0,00" />
          </Field>
          <Field label="Prazo (anos)" htmlFor="sim-years">
            <input id="sim-years" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ""))} className={inputClass} />
          </Field>
          <Field label="Rentabilidade anual (%)" htmlFor="sim-rate">
            <input id="sim-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="Digite a sua estimativa" className={inputClass} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>Exemplos, só para preencher (não são promessa):</span>
          {RATE_EXAMPLES.map((ex) => (
            <button key={ex.rate} type="button" onClick={() => setRate(ex.rate)} className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-ink2 hover:border-primary hover:text-primary">
              {ex.label}
            </button>
          ))}
        </div>
        {problem && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{problem}</p>}
      </Panel>

      {!problem && (rateN === null || empty) && (
        <Panel title="Resultado" subtitle="Preencha o aporte (ou o valor inicial) e a rentabilidade">
          <Empty>Digite a rentabilidade anual que você quer simular e um aporte mensal ou um valor inicial. Nada é calculado sem isso.</Empty>
        </Panel>
      )}

      {result && !empty && !problem && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
            <StatCard label="Total investido" value={formatBRLShort(result.invested)} hint={`em ${yearsN} ${yearsN === 1 ? "ano" : "anos"}`} />
            <StatCard label="Rendimento estimado" value={formatBRLShort(result.interest)} hint={`a ${rateN!.toLocaleString("pt-BR")}% ao ano`} tone={result.interest > 0 ? "good" : "default"} />
            <StatCard label="Valor final" value={formatBRLShort(result.final)} hint="investido + rendimento" highlight />
          </div>

          <Panel title="Evolução" subtitle="Ano a ano, com os números acima">
            <ChartLine
              tapDetail
              labels={result.points.map((p) => (p.year === 0 ? "Hoje" : `${p.year}a`))}
              series={[
                { name: "Investido", color: "hsl(var(--exp))", values: result.points.map((p) => p.invested) },
                { name: "Valor estimado", color: "hsl(var(--inc))", values: result.points.map((p) => p.value), area: true },
              ]}
            />
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-exp" />Investido</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-inc" />Valor estimado</span>
            </div>
          </Panel>

          <Panel title="Renda passiva por dividendos" subtitle="Quanto o valor final poderia render por mês, com o yield que você informar">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Yield anual estimado (%)" htmlFor="sim-yield">
                <input id="sim-yield" inputMode="decimal" value={yieldText} onChange={(e) => setYieldText(e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="Digite a sua estimativa" className={inputClass} />
              </Field>
              <Field label="Proventos que você recebe por mês" hint="(opcional, para o yield on cost)" htmlFor="sim-dividends">
                <MoneyInput id="sim-dividends" value={dividends} onChange={setDividends} placeholder="0,00" />
              </Field>
            </div>
            {income !== null && (
              <p className="mt-3 text-[13.5px] text-ink2">
                Com <b className="num text-foreground">{formatBRL(result.final)}</b> investidos e yield de {yieldN!.toLocaleString("pt-BR")}% ao ano, a renda passiva estimada é de cerca de <b className="num text-foreground">{formatBRL(income)}</b> por mês.
              </p>
            )}
            {target !== null && <p className="mt-1.5 text-[13px] text-muted-foreground">Para cada R$ 1.000 por mês de renda passiva, com esse yield, seriam necessários cerca de {formatBRL(target)} investidos.</p>}
            {cost !== null && <p className="mt-1.5 text-[13px] text-muted-foreground">Yield on cost: {formatBRL(dividendsCents!)} por mês sobre {formatBRL(result.invested)} investidos = {cost.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ao ano.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}
