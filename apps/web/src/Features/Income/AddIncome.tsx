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
import { parseBRL, sanitizeAmountInput } from "../../lib/money";
import { useFinanceStore } from "../../Store/FinanceStore";
import { showToast } from "../Warnings/ToastContainer";
import IncomeList from "./IncomeList";

export default function IncomeForm() {
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const currentMonth = useFinanceStore((state) => state.currentMonth);

  const [isFixed, setIsFixed] = useState(false);

  function handleAddIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const nameIncome = ((formData.get("nameIncome") as string) ?? "").trim();
    const priceIncome = parseBRL(formData.get("price") as string);

    if (!nameIncome) {
      showToast({ type: "error", text: "Preencha o nome da renda" });
      return;
    }

    if (!priceIncome) {
      showToast({
        type: "error",
        text: "Informe um valor válido maior que zero",
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
      month: currentMonth,
    });

    showToast({
      type: "success",
      text: `Renda "${nameIncome}" adicionada`,
    });

    setIsFixed(false);
    e.currentTarget.reset();
  }

  return (
    <div>
      {/* Listagem das rendas */}
      <IncomeList />

      {/* Card do formulário */}
      <Card className="border border-dashed bg-card border-border  mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold font-sans text-foreground">
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
                  placeholder:text-foreground/80 text-lg font-bold
                  focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                />
              </section>

              <section className="relative w-60 shrink-0">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/80 font-bold">
                  R$
                </span>

                <input
                  type="text"
                  name="price"
                  required
                  inputMode="decimal"
                  onChange={(e) => {
                    e.target.value = sanitizeAmountInput(e.target.value);
                  }}
                  placeholder="00,00"
                  className="appearance-none border rounded-lg 
                  pl-12 pr-4 py-3 w-full
                  placeholder:text-foreground/80 text-lg font-bold
                  focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                />
              </section>
            </div>

            <section className="flex-auto bg-secondary rounded-xl py-3">
              <div className="flex justify-between">
                <section className="flex items-center">
                  <Checkbox
                    checked={isFixed}
                    onCheckedChange={(checked) => setIsFixed(Boolean(checked))}
                    className="h-[20px] w-[20px] rounded-sm border border-border
            data-[state=checked]:bg-primary
            data-[state=checked]:border-primary
            data-[state=checked]:text-foreground ml-4 flex items-center justify-center"
                  >
                    {isFixed && <Check className="h-4 w-4 text-foreground" />}
                  </Checkbox>
                  <h1 className="py-0.5 pl-4 text-lg text-foreground/80 font-bold flex items-center gap-2">
                    <MdOutlinePushPin className="mb-0.5 w-5 h-5 text-primary" />
                    Fixar renda
                  </h1>
                </section>

                <section className="flex items-center">
                  {isFixed && (
                    <span className="mr-4 text-success font-medium px-3 py-1 rounded-2xl bg-primary/20">
                      Todos os meses
                    </span>
                  )}
                </section>
              </div>
            </section>
            <section className="text-muted-foreground font-medium ml-2">
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
                className="bg-primary hover:bg-primary/80 text-lg !px-6 !py-6 font-medium"
              >
                <IoAddOutline className="!h-5 !w-5 !font-medium !text-foreground !font-extraligth" />
                {isFixed ? "Adicionar Renda Fixa" : "Adicionar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
