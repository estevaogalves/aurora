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
    <div className="mt-6 w-[1440px] mx-44">
      <Card className="rounded-xl bg-slate-900 border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg text-slate-300 font-bold">
            Despesas dividas identificadas
          </CardTitle>
          <CardDescription className="text-base text-slate-400 font-medium">
            Projetando uma visão de tempo para cada despesa dividida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreditList/>
          {/* <div className="flex items-center gap-2 text-slate-600 mt-5">
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
