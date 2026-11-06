import { Checkbox } from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useState } from "react";
import { IoAddOutline } from "react-icons/io5";
import { MdOutlinePushPin } from "react-icons/md";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useFinanceStore } from "../../Store/FinanceStore";
import { showToast } from "../Warnings/ToastContainer";
import IncomeList from "./IncomeList";

export default function IncomeForm() {
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const [isFixed, setIsFixed] = useState(false);

  function handleAddIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const nameIncome = formData.get("nameIncome") as string;
    const rawValue = formData.get("price") as string;
    const priceIncome = Number(rawValue.replace(",", "."));

    setIsFixed(false)

    if (!nameIncome || !priceIncome) {
      showToast({
        type: "error",
        text: "Preencha nome e valor da renda",
      });
      return;
    }

    addTransaction({
      id: crypto.randomUUID(),
      name: nameIncome,
      amount: priceIncome,
      type: "income",
      fixed: isFixed,
      category: "Renda",
      month: new Date().toISOString().slice(0, 7),
    });

    showToast({
      type: "success",
      text: `Renda "${nameIncome}" adicionada`,
    });

    e.currentTarget.reset();
  }

  return (
    <div>
      {/* Listagem das rendas */}
      <IncomeList />

      {/* Card do formulário */}
      <Card className="border border-dashed bg-slate-900 border-slate-400  mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold font-sans text-white">
            Adicionar fonte de renda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4 w-full"
            onSubmit={handleAddIncome}
          >
            <div className="flex w-full gap-3">
              <section className="flex-1">
                <input
                  type="text"
                  name="nameIncome"
                  required
                  placeholder="Ex: Salário, Freelance, Aluguel..."
                  className="w-full border rounded-lg px-4 py-3 text-left 
                  placeholder:text-gray-300 text-lg font-bold
                  focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-900 text-white"
                />
              </section>

              <section className="relative w-60 shrink-0">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold">
                  R$
                </span>

                <input
                  type="text"
                  name="price"
                  required
                  inputMode="decimal"
                  placeholder="00,00"
                  className="appearance-none border rounded-lg 
                  pl-12 pr-4 py-3 w-full
                  placeholder:text-gray-300 text-lg font-bold
                  focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-900 text-white"
                />
              </section>
            </div>

            <section className="flex-auto bg-slate-800/30 rounded-xl py-3">
              <div className="flex justify-between">
                <section className="flex items-center">
                  <Checkbox
                    checked={isFixed}
                    onCheckedChange={(checked) => setIsFixed(Boolean(checked))}
                    className="h-[20px] w-[20px] rounded-sm border border-gray-300
            data-[state=checked]:bg-green-600
            data-[state=checked]:border-green-600
            data-[state=checked]:text-white ml-4 flex items-center justify-center"
                  >
                    {isFixed && <Check className="h-4 w-4 text-white" />}
                  </Checkbox>
                  <h1 className="py-0.5 pl-4 text-lg text-gray-300 font-bold flex items-center gap-2">
                    <MdOutlinePushPin className="mb-0.5 w-5 h-5 text-green-600" />
                    Fixar renda
                  </h1>
                </section>

                <section className="flex items-center">
                  {isFixed && (
                    <span className="mr-4 text-green-500 font-medium px-3 py-1 rounded-2xl bg-green-900/50">
                      Todos os meses
                    </span>
                  )}
                </section>
              </div>
            </section>
            <section className="text-slate-400 font-medium ml-2">
              {isFixed && (
                <p>
                  Rendas fixas aparecem automaticamente em todos os meses. Voce
                  pode ajustar o valor individualmente em cada mês se precisar.
                </p>
              )}
            </section>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-green-800 hover:bg-green-900 text-lg !px-6 !py-6 font-medium"
              >
                <IoAddOutline className="!h-5 !w-5 !font-medium !text-white !font-extraligth" />
                {isFixed ? "Adicionar Renda Fixa" : "Adicionar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
