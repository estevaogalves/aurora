import { FaTrash } from "react-icons/fa6";
import { LuClock4 } from "react-icons/lu";
import { Card } from "../../../components/ui/card";

interface CreditItem {
  id: string;
  name: string;
  category: string;
  installmentValue: number;
  currentInstallment: number;
  installments: number;
  totalAmount: number;
}

interface Props {
  expenses: CreditItem[];
  onDelete: (id: string) => void;
}

export default function ExpenseCreditCard({ expenses, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {expenses.map((expense) => {
        const progress =
          (expense.currentInstallment / expense.installments) * 100;

        const remaining =
          expense.installments - expense.currentInstallment;

        return (
          <Card
            key={expense.id}
            className="bg-slate-900 border-slate-600 p-5"
          >
            {/* HEADER */}
            <div className="flex justify-between">
              <section className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-700" />

                <div className="flex items-center gap-3 text-white">
                  <h1 className="font-bold">{expense.name}</h1>

                  <p className="text-sm rounded-xl bg-slate-800 px-3 py-0.5 font-medium">
                    {expense.currentInstallment}/{expense.installments}
                  </p>
                </div>
              </section>

              <section className="flex items-center gap-3 text-white">
                <span className="font-bold text-lg">
                  R${" "}
                  {expense.installmentValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  }) ?? "0,00"}
                </span>

                <button 
                onClick={() => onDelete(expense.id)}
                className="p-2 rounded-lg border hover:bg-red-900 hover:border-red-400">
                  <FaTrash />
                </button>
              </section>
            </div>

            {/* PROGRESSO */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 bg-slate-800 rounded-full h-2">
                <div
                  className="bg-purple-700 h-2 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="text-white font-bold whitespace-nowrap flex items-center gap-2">
                <LuClock4 className="text-lg" />
                Faltam {remaining} parcelas
              </span>
            </div>

            {/* TOTAL */}
            <div className="flex items-start mt-3">
              <h1 className="text-slate-400 font-medium">
                Total da compra: R${" "}
               {(expense.totalAmount ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2
               })}
              </h1>
            </div>
          </Card>
        );
      })}
    </div>
  );
}