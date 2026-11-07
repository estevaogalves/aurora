import { GoTag } from "react-icons/go";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

import ExpensesList from "./ExpensesList";
import GraphicsExpenses from "./GraphicsExpenses";

import {
  useHiddenTransactions,
  useMonthCredit,
  useMonthTransactions,
} from "../../Store/selectors";

export default function Expenses() {
  // só o que vale no mês que está sendo visto
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();
  const hidden = useHiddenTransactions().filter((t) => t.type === "expense");

  const hasAnyExpenses =
    expenses.length > 0 || credit.length > 0 || hidden.length > 0;
  const hasVisibleExpenses = expenses.length > 0 || credit.length > 0;

  return (
    <div className="mt-6">
      <Card className="px-3 pb-6 bg-card border-border ">
        <CardHeader>
          <div className="flex items-center justify-between">
            <section>
              <CardTitle className="text-xl font-bold text-foreground">
                Despesas do mês
              </CardTitle>

              <CardDescription className="text-lg font-sans text-foreground/80 font-medium">
                {expenses.length + credit.length}{" "}
                {expenses.length + credit.length === 1 ? "despesa cadastrada" : "despesas cadastradas"}
              </CardDescription>
            </section>

          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center mt-9 text-center px-4">
          {hasAnyExpenses ? (
            <ExpensesList expenses={expenses} />
          ) : (
            <div>
              <span className="bg-card border border-border rounded-xl p-7 mb-6 inline-block">
                <GoTag className="text-4xl text-foreground/80" />
              </span>

              <div className="space-y-1">
                <h1 className="font-bold text-foreground/80 text-lg mb-3">
                  Sem despesas neste mês
                </h1>

                <p className="text-lg text-foreground/80 max-w-[350px] font-bold">
                  Use o botão Lançar para adicionar uma despesa
                </p>
              </div>
            </div>
          )}
        </CardContent>

      </Card>

      {hasVisibleExpenses && <GraphicsExpenses />}
    </div>
  );
}