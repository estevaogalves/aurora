// este arquivo vai mostrar quando o saldo final estiver negativo
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { RiAlertLine } from "react-icons/ri";

export default function CardNegative() {
  return (
    <div>
      <Card className="bg-card border border-destructive">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="text-2xl border px-1.5 py-1.5 rounded-lg bg-destructive/10 text-destructive border-destructive">
              <RiAlertLine />
            </div>

            <section>
              <CardTitle className="text-xl font-sans font-bold text-foreground">
                  Atenção com suas Finanças
              </CardTitle>
              <CardDescription className="text-base font-sans font-medium text-foreground/80">
                Você precisa ajustar seu orçamento.
              </CardDescription>
            </section>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <section className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1 border rounded-lg bg-destructive/10 text-destructive border-destructive p-1">
                <RiAlertLine className="text-destructive" />
              </span>
              <p className="text-base font-medium text-foreground/80">
                Suas despesas ultrapassam sua renda. Revise urgentemente seus
                gastos e veja o que pode ser cortado ou reduzido.
              </p>
            </section>
            <section className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1 border rounded-lg bg-destructive/10 text-destructive border-destructive p-1">
                <RiAlertLine className="text-destructive" />
              </span>
              <p className="text-base font-medium text-foreground/80">
                Considere buscar uma renda extra ou renegociar dividas para
                equilibrar seu orcamento.
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
