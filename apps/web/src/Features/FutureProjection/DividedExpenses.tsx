import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import CreditList from "./Lists/CreditList";

export default function DividedExpenses() {
  return (
    <div className="mt-6 w-full">
      <Card className="rounded-xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground/80 font-bold">
            Despesas dividas identificadas
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground font-medium">
            Projetando uma visão de tempo para cada despesa dividida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreditList/>
          {/* <div className="flex items-center gap-2 text-muted-foreground mt-5">
            <BiInfoCircle className="text-xl mb-1"/>
            <span className="text-lg font-medium">
              Cadastre despesas divididas no cartão de cŕedito para termos uma
              visualização de tempo
            </span>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
