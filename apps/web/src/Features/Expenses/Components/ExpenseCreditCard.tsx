import { FaTrash } from "react-icons/fa6";
import { LuClock4 } from "react-icons/lu";
import { Card } from "../../../components/ui/card";
import { formatBRL } from "../../../lib/money";

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
            className="bg-card border-border p-5"
          >
            {/* HEADER */}
            <div className="flex justify-between">
              <section className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-700" />

                <div className="flex items-center gap-3 text-foreground">
                  <h1 className="font-bold">{expense.name}</h1>

                  <p className="text-sm rounded-xl bg-secondary px-3 py-0.5 font-medium">
                    {expense.currentInstallment}/{expense.installments}
                  </p>
                </div>
              </section>

              <section className="flex items-center gap-3 text-foreground">
                <span className="font-bold text-lg">
                  {formatBRL(expense.installmentValue)}
                </span>

                <button 
                onClick={() => onDelete(expense.id)}
                className="p-2 rounded-lg border hover:bg-destructive/90 hover:border-destructive">
                  <FaTrash />
                </button>
              </section>
            </div>

            {/* PROGRESSO */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 bg-secondary rounded-full h-2">
                <div
                  className="bg-purple-700 h-2 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="text-foreground font-bold whitespace-nowrap flex items-center gap-2">
                <LuClock4 className="text-lg" />
                Faltam {remaining} parcelas
              </span>
            </div>

            {/* TOTAL */}
            <div className="flex items-start mt-3">
              <h1 className="text-muted-foreground font-medium">
                Total da compra: {formatBRL(expense.totalAmount ?? 0)}
              </h1>
            </div>
          </Card>
        );
      })}
    </div>
  );
}