// CARD EXTERNO PRINCIPAL QUE FALA SOBRE AS RENDAS. O FORMULÁRIO E A LISTAGEM DAS RENDAS
// ESTÃO EM OUTROS DOIS ARQUIVOS

import { PiCurrencyDollar } from "react-icons/pi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { formatBRL } from "../../lib/money";
import { useMonthSummary, useMonthTransactions } from "../../Store/selectors";
import AddIncome from "./AddIncome";

export default function Incomes() {
  const incomes = useMonthTransactions().filter((t) => t.type === "income");
  const { totalIncome: totalIncomes } = useMonthSummary();

  return (
    <div className="">
      <Card className="bg-card border-border ">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary border border-primary rounded-lg text-2xl">
              <PiCurrencyDollar size={18} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Suas Rendas
              </CardTitle>
              <CardDescription className="text-lg text-foreground/80 font-sans font-medium">
                 {incomes.length > 0 ? `Total: ${formatBRL(totalIncomes)} em ${incomes.length} ${incomes.length === 1 ? "fonte" : "fontes"}` :  "Adicione suas fontes de renda do mês"}
              </CardDescription>
              {/* Total: R$ 00,00 de x fonte */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AddIncome />
        </CardContent>
      </Card>
    </div>
  );
}
