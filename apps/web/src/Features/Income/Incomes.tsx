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
import { useFinanceStore } from "../../Store/FinanceStore";
import AddIncome from "./AddIncome";

export default function Incomes() {
  const transactions = useFinanceStore((state) => state.transactions);
  const incomes = transactions.filter((t) => t.type === "income");

  const getTotals = useFinanceStore((state) => state.getTotals);

  const totals = getTotals();
  const totalIncomes = totals.totalIncome;

  return (
    <div className="">
      <Card className="bg-slate-900 border-slate-600 ">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-950 text-emerald-600 border border-emerald-600 rounded-lg text-2xl">
              <PiCurrencyDollar size={18} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Suas Rendas
              </CardTitle>
              <CardDescription className="text-lg text-zinc-300 font-sans font-medium">
                 {incomes.length > 0 ? `Total: R$ ${totalIncomes.toLocaleString("pt-BR")} em ${incomes.length} fonte` :  "Adicione suas fontes de renda do mês"}
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
