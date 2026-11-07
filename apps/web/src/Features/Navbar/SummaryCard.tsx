import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";
import { LuWallet } from "react-icons/lu";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { formatBRL } from "../../lib/money";
import { useMonthSummary } from "../../Store/selectors";

export default function SummaryCard() {
  const { totalIncome, totalExpense, balance, expensePercentage } =
    useMonthSummary();

  return (
    <div className="mx-44 pt-6">
      <div className="grid grid-cols-3 gap-6">
        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex items-center gap-4">
              {/* Ícone */}
              <div className="p-3 bg-green-950 text-emerald-600 border border-emerald-600 rounded-lg text-2xl">
                <LuWallet size={18} />
              </div>
              {/* Textos */}
              <div>
                <CardTitle className="text-xl text-zinc-300 font-sans font-medium">
                  Renda Total
                </CardTitle>
                <h1 className="text-2xl font-bold font-sans text-white">
                  {formatBRL(totalIncome)}
                </h1>
                <CardDescription className="text-lg text-zinc-300 font-sans font-medium">
                  Soma de todas as fontes
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-xl bg-slate-900 border-slate-600 ">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex items-center gap-4">
              {/* Ícone */}
              <div className="p-3 bg-red-950 text-red-600 border border-red-600 rounded-lg text-2xl">
                <FaArrowTrendDown size={18} />
              </div>
              {/* Textos */}
              <div>
                <CardTitle className="text-xl text-zinc-300 font-sans font-medium">
                  Total de Despesas
                </CardTitle>
                <h1 className="text-2xl font-bold font-sans text-white">
                  {formatBRL(totalExpense)}
                </h1>
                <CardDescription className="text-lg text-zinc-300 font-sans font-medium">
                  {expensePercentage.toFixed(2)}% da renda
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex items-center gap-4">
              {/* Ícone */}
              <div className="p-3 bg-green-950 text-emerald-600 border border-emerald-600 rounded-lg text-2xl">
                <FaArrowTrendUp size={18} />
              </div>
              {/* Textos */}
              <div>
                <CardTitle className="text-xl text-zinc-300 font-sans font-medium">
                  Saldo Restante
                </CardTitle>
                <h1 className="text-2xl font-bold font-sans text-white">
                  {formatBRL(balance)}
                </h1>
                <CardDescription className="text-lg text-zinc-300 font-sans font-medium">
                  Disponivel para uso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
