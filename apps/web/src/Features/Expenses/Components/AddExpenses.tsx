import { useEffect, useState } from "react";
// componentes
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
// zustand
import type { Transaction } from "../../../Store/FinanceStore";
import { useFinanceStore } from "../../../Store/FinanceStore";
// types
import type { Category } from "../../../Types/Category";
// react icons
import { FaRegCreditCard } from "react-icons/fa6";
import { IoCloseOutline } from "react-icons/io5";

// paginas
import { showToast } from "../../Warnings/ToastContainer";

interface AddExpensesProps {
  onCloseCard: () => void;
}

export default function AddExpenses({ onCloseCard }: AddExpensesProps) {
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const [category, setCategory] = useState<Category>("Moradia");
  const [isFixed, setIsFixed] = useState(false);
  const [active, setActive] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [totalPrice, setTotalPrice] = useState("");
  const [installments, setInstallments] = useState(1);
  const [price, setPrice] = useState("");

  // 👇 cálculo seguro
  const parsedTotal = Number(totalPrice.replace(",", "."));
  const installmentValue =
    !isNaN(parsedTotal) && installments > 0 ? parsedTotal / installments : 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const name = formData.get("nameExpense") as string;
    const observation = (formData.get("observation") as string) || "";

    // 👇 CASO SEJA CRÉDITO
    if (active) {
      const totalAmount = Number(
        (formData.get("totalPrice") as string)?.replace(",", ".") || 0,
      );

      const installments = Number(formData.get("installments") || 1);

      const creditTransaction = {
        id: crypto.randomUUID(),
        name,
        totalAmount,
        installments,
        startMonth: currentMonth,
        category,
      };

      useFinanceStore.getState().addCreditTransaction(creditTransaction);

      showToast({
        type: "success",
        text: `Compra parcelada "${name}" adicionada!`,
      });

      onCloseCard();
      return;
    }

    // 👇 CASO NORMAL
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      name,
      amount: Number((formData.get("price") as string)?.replace(",", ".") || 0),
      type: "expense",
      category,
      notes: observation,
      fixed: isFixed,
      month: currentMonth,
    };

    addTransaction(transaction);

    showToast({
      type: "success",
      text: `Despesa ${transaction.name} adicionada com sucesso!`,
    });

    onCloseCard();
  }

  return (
    <div className="flex items-center justify-center fixed inset-0 backdrop-blur-sm bg-black/90 z-50">
      {" "}
      <Card className="w-[540px] border bg-slate-900 border-slate-600 ">
        <CardHeader className="mx-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold font-sans text-white">
              Adicionar Despesa
            </CardTitle>
            <button onClick={onCloseCard} className="mt-1 text-white">
              <IoCloseOutline size={24} />
            </button>
          </div>
          <CardDescription className="text-base font-sans font-medium text-zinc-300 pr-4">
            Preencha os dados da despesa deste mês.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Nome */}
            <div className="flex flex-col gap-2">
              <label className="font-bold font-sans text-lg text-white">
                Nome da despesa
              </label>
              <input
                type="text"
                name="nameExpense"
                required
                placeholder="Ex: Aluguel, Internet..."
                className="border px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-green-600 font-semibold bg-slate-900 text-white"
              />
            </div>

            {/* card de pagamento no crédito */}
            <div className="border rounded-xl px-3 py-2 mt-2 flex items-center justify-between">
              <section className="flex items-center gap-3">
                <FaRegCreditCard className="text-zinc-400 text-2xl" />
                <div>
                  <h1 className="text-white font-bold text-base">
                    Compra parcelada no crédito
                  </h1>
                  <p className="text-zinc-400 font-medium text-sm">
                    Controle suas parcelas com contagem automática
                  </p>
                </div>
              </section>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                className="data-[state=unchecked]:bg-zinc-400 data-[state=checked]:bg-green-500"
              />
            </div>

            {active && (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <section className="flex flex-col">
                    <h3 className="text-lg font-bold text-white">
                      Valor total da compra
                    </h3>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-gray-400 font-bold">
                        R$
                      </span>
                      <input
                        type="text"
                        name="totalPrice"
                        required
                        value={totalPrice}
                        onChange={(e) => {
                          let value = e.target.value

                          value = value.replace(/[^0-9,]/g, "")

                          const parts = value.split(",")
                          if (parts.length > 2) {
                            value = parts[0] + "," + parts[1]
                          }

                          if(parts[1]?.length > 2) {
                            parts[1] = parts[1].slice(0, 2)
                            value = parts.join(",")
                          }

                          setTotalPrice(value)
                        }}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0,00"
                        className="border rounded-lg py-2 mt-2 bg-slate-900 text-white pl-9 font-bold w-[280px] text-lg"
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white">
                      Total de parcelas
                    </h3>
                    <input
                      type="number"
                      name="installments"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      min={1}
                      max={60}
                      className="border rounded-lg py-2 mt-2 bg-slate-900 text-white pl-3 pr-4 w-[180px] text-lg "
                    />
                  </section>
                </div>

                {/* 👇 Agora ocupa largura total */}
                <span className="text-md text-gray-400 font-medium ">
                  <strong className="text-green-600">Observação:</strong> O
                  valor da parcela será calculado automáticamente
                </span>
              </div>
            )}

            {/* Valor */}
            <div className="flex flex-col gap-2">
              <label className="font-bold font-sans text-lg text-white">
                {active ? "Valor da parcela (R$)" : "Valor deste mês (R$)"}
                {active ? null : (
                  <span className="text-sm text-gray-300 ml-1 font-medium">
                    (Pode ser alterado depois)
                  </span>
                )}
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  R$
                </span>

                <input
                  type="text"
                  name="price"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  disabled={active}
                  value={
                    active
                      ? installmentValue.toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })
                      : price
                  }
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="appearance-none border border-zinc-300 rounded-lg 
pl-9 pr-4 py-2 w-full
placeholder:text-gray-400
disabled:placeholder:text-gray-400
disabled:opacity-100
text-lg font-bold
focus:outline-none focus:ring-2 focus:ring-green-600
bg-slate-900 text-white"
                />
              </div>
            </div>

            {active ? null : (
              <>
                {/* Categoria */}
                <div className="flex flex-col gap-2">
                  <label className="font-bold font-sans text-lg text-white">
                    Categoria
                  </label>

                  <Select
                    value={category}
                    onValueChange={(value: string) =>
                      setCategory(value as Category)
                    }
                  >
                    <SelectTrigger className="w-[250px] font-medium text-md h-[45px] text-white">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          value="Moradia"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Moradia
                        </SelectItem>
                        <SelectItem
                          value="Transporte"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Transporte
                        </SelectItem>
                        <SelectItem
                          value="Alimentação"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Alimentação
                        </SelectItem>
                        <SelectItem
                          value="Saúde"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Saúde
                        </SelectItem>
                        <SelectItem
                          value="Educação"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Educação
                        </SelectItem>
                        <SelectItem
                          value="Lazer"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Lazer
                        </SelectItem>
                        <SelectItem
                          value="Serviços"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Serviços
                        </SelectItem>
                        {/* <SelectItem
                          value="Crédito/Parcelado"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Crédito/Parcelado
                        </SelectItem> */}
                        <SelectItem
                          value="Outros"
                          className="cursor-pointer data-[highlighted]:bg-green-600 data-[highlighted]:text-white font-bold text-sm"
                        >
                          Outros
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Observação */}
            <div className="flex flex-col gap-2">
              <label className="font-bold font-sans text-lg text-white">
                Observação
                <span className="text-sm text-gray-300 ml-1 font-medium">
                  (opcional)
                </span>
              </label>

              <Textarea
                name="observation"
                placeholder="Anotações sobre essa despesa..."
                className="rounded-xl border border-gray-200 
             placeholder:font-sans placeholder:text-base placeholder:text-gray-300
             !min-h-[120px] !text-base placeholder:font-medium font-semibold
             focus:!ring-2 focus:!ring-green-600 focus:!outline-none bg-slate-900 text-white"
              />
            </div>

            {active ? null : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="font-bold font-sans text-lg text-white">
                    É uma despesa fixa?
                  </h1>
                  <Checkbox
                    checked={isFixed}
                    onCheckedChange={(checked) => setIsFixed(Boolean(checked))}
                    className="h-[20px] w-[20px] border-gray-300
            data-[state=checked]:bg-green-600
            data-[state=checked]:border-green-600
            data-[state=checked]:text-white"
                  />
                </div>
              </>
            )}

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 mt-3">
              <Button
                type="button"
                onClick={onCloseCard}
                className="bg-slate-300 text-black hover:bg-gray-200 border border-slate-600 px-7 py-5 font-bold text-base"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                className="bg-green-800 border border-emerald-600 hover:bg-green-900 text-white px-7 py-5 font-bold text-base"
              >
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
