import { useState } from "react";
import { GoTag } from "react-icons/go";
import { IoAddOutline } from "react-icons/io5";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

import AddExpenses from "./Components/AddExpenses";
import ExpensesList from "./ExpensesList";
import GraphicsExpenses from "./GraphicsExpenses";

import { useFinanceStore } from "../../Store/FinanceStore";

export default function Expenses() {
  const [showCard, setShowCard] = useState(false);

  // pega todas transações do zustand
  const transactions = useFinanceStore((state) => state.transactions);
  const creditTransactions = useFinanceStore(
    (state) => state.creditTransactions
  )
  const expenses = transactions.filter((t) => t.type === "expense");

  const hasAnyExpenses = expenses.length > 0 || creditTransactions.length > 0

  // filtra apenas despesas

  const openCard = () => {
    setShowCard(true);
  };

  const closeCard = () => {
    setShowCard(false);
  };

  return (
    <div className="mt-6">
      <Card className="px-3 pb-6 bg-slate-900 border-slate-600 ">
        <CardHeader>
          <div className="flex items-center justify-between">
            <section>
              <CardTitle className="text-xl font-bold text-white">
                Despesas do mês
              </CardTitle>

              <CardDescription className="text-lg font-sans text-zinc-300 font-medium">
                {expenses.length} despesas cadastradas
              </CardDescription>
            </section>

            <Button
              onClick={openCard}
              className="px-4 py-6 text-lg bg-green-800 hover:bg-green-900 text-white border border-emerald-600"
            >
              <IoAddOutline className="!h-[30px] !w-[20px]"/>
              Nova despesa
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center mt-9 text-center px-4">
          {hasAnyExpenses ? (
            <ExpensesList expenses={expenses} />
          ) : (
            <div>
              <span className="bg-slate-900 border border-slate-300 rounded-xl p-7 mb-6 inline-block">
                <GoTag className="text-4xl text-slate-300" />
              </span>

              <div className="space-y-1">
                <h1 className="font-bold text-slate-300 text-lg mb-3">
                  Sem despesas neste mês
                </h1>

                <p className="text-lg text-slate-300 max-w-[350px] font-bold">
                  Adicione uma nova despesa para começar
                </p>
              </div>
            </div>
          )}
        </CardContent>

        {showCard && <AddExpenses onCloseCard={closeCard} />}
      </Card>

      {hasAnyExpenses && <GraphicsExpenses />}
    </div>
  );
}