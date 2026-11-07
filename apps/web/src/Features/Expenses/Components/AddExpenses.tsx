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
// utilitários de dinheiro
import {
  centsToInput,
  parseBRL,
  sanitizeAmountInput,
  splitInstallments,
} from "../../../lib/money";
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
  const currentMonth = useFinanceStore((state) => state.currentMonth);

  const [totalPrice, setTotalPrice] = useState("");
  const [installments, setInstallments] = useState(1);
  const [price, setPrice] = useState("");

  // valor da 1ª parcela, em centavos (as parcelas somam exatamente o total)
  const totalCents = parseBRL(totalPrice) ?? 0;
  const installmentValue =
    installments > 0 ? splitInstallments(totalCents, installments)[0] : 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const name = ((formData.get("nameExpense") as string) ?? "").trim();
    const observation = (formData.get("observation") as string) || "";

    if (!name) {
      showToast({ type: "error", text: "Preencha o nome da despesa" });
      return;
    }

    // 👇 CASO SEJA CRÉDITO
    if (active) {
      const totalAmount = parseBRL(formData.get("totalPrice") as string);

      if (!totalAmount) {
        showToast({
          type: "error",
          text: "Informe um valor total válido maior que zero",
        });
        return;
      }

      const installments = Math.min(
        60,
        Math.max(1, Math.floor(Number(formData.get("installments")) || 1)),
      );

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
    const amount = parseBRL(formData.get("price") as string);

    if (!amount) {
      showToast({
        type: "error",
        text: "Informe um valor válido maior que zero",
      });
      return;
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      name,
      amount,
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
      <Card className="w-[540px] border bg-card border-border ">
        <CardHeader className="mx-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold font-sans text-foreground">
              Adicionar Despesa
            </CardTitle>
            <button onClick={onCloseCard} className="mt-1 text-foreground">
              <IoCloseOutline size={24} />
            </button>
          </div>
          <CardDescription className="text-base font-sans font-medium text-foreground/80 pr-4">
            Preencha os dados da despesa deste mês.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Nome */}
            <div className="flex flex-col gap-2">
              <label className="font-bold font-sans text-lg text-foreground">
                Nome da despesa
              </label>
              <input
                type="text"
                name="nameExpense"
                required
                placeholder="Ex: Aluguel, Internet..."
                className="border px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary font-semibold bg-card text-foreground"
              />
            </div>

            {/* card de pagamento no crédito */}
            <div className="border rounded-xl px-3 py-2 mt-2 flex items-center justify-between">
              <section className="flex items-center gap-3">
                <FaRegCreditCard className="text-muted-foreground text-2xl" />
                <div>
                  <h1 className="text-foreground font-bold text-base">
                    Compra parcelada no crédito
                  </h1>
                  <p className="text-muted-foreground font-medium text-sm">
                    Controle suas parcelas com contagem automática
                  </p>
                </div>
              </section>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                className="data-[state=unchecked]:bg-secondary data-[state=checked]:bg-primary"
              />
            </div>

            {active && (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <section className="flex flex-col">
                    <h3 className="text-lg font-bold text-foreground">
                      Valor total da compra
                    </h3>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground font-bold">
                        R$
                      </span>
                      <input
                        type="text"
                        name="totalPrice"
                        required
                        value={totalPrice}
                        onChange={(e) =>
                          setTotalPrice(sanitizeAmountInput(e.target.value))
                        }
                        inputMode="decimal"
                        placeholder="0,00"
                        className="border rounded-lg py-2 mt-2 bg-card text-foreground pl-9 font-bold w-[280px] text-lg"
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-foreground">
                      Total de parcelas
                    </h3>
                    <input
                      type="number"
                      name="installments"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      min={1}
                      max={60}
                      className="border rounded-lg py-2 mt-2 bg-card text-foreground pl-3 pr-4 w-[180px] text-lg "
                    />
                  </section>
                </div>

                {/* 👇 Agora ocupa largura total */}
                <span className="text-md text-muted-foreground font-medium ">
                  <strong className="text-primary">Observação:</strong> O
                  valor da parcela será calculado automáticamente
                </span>
              </div>
            )}

            {/* Valor */}
            <div className="flex flex-col gap-2">
              <label className="font-bold font-sans text-lg text-foreground">
                {active ? "Valor da parcela (R$)" : "Valor deste mês (R$)"}
                {active ? null : (
                  <span className="text-sm text-foreground/80 ml-1 font-medium">
                    (Pode ser alterado depois)
                  </span>
                )}
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                  R$
                </span>

                <input
                  type="text"
                  name="price"
                  required
                  inputMode="decimal"
                  disabled={active}
                  value={active ? centsToInput(installmentValue) : price}
                  onChange={(e) => setPrice(sanitizeAmountInput(e.target.value))}
                  placeholder="0,00"
                  className="appearance-none border border-border rounded-lg 
pl-9 pr-4 py-2 w-full
placeholder:text-muted-foreground
disabled:placeholder:text-muted-foreground
disabled:opacity-100
text-lg font-bold
focus:outline-none focus:ring-2 focus:ring-primary
bg-card text-foreground"
                />
              </div>
            </div>

            {active ? null : (
              <>
                {/* Categoria */}
                <div className="flex flex-col gap-2">
                  <label className="font-bold font-sans text-lg text-foreground">
                    Categoria
                  </label>

                  <Select
                    value={category}
                    onValueChange={(value: string) =>
                      setCategory(value as Category)
                    }
                  >
                    <SelectTrigger className="w-[250px] font-medium text-md h-[45px] text-foreground">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          value="Moradia"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Moradia
                        </SelectItem>
                        <SelectItem
                          value="Transporte"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Transporte
                        </SelectItem>
                        <SelectItem
                          value="Alimentação"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Alimentação
                        </SelectItem>
                        <SelectItem
                          value="Saúde"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Saúde
                        </SelectItem>
                        <SelectItem
                          value="Educação"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Educação
                        </SelectItem>
                        <SelectItem
                          value="Lazer"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Lazer
                        </SelectItem>
                        <SelectItem
                          value="Serviços"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Serviços
                        </SelectItem>
                        {/* <SelectItem
                          value="Crédito/Parcelado"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
                        >
                          Crédito/Parcelado
                        </SelectItem> */}
                        <SelectItem
                          value="Outros"
                          className="cursor-pointer data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground font-bold text-sm"
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
              <label className="font-bold font-sans text-lg text-foreground">
                Observação
                <span className="text-sm text-foreground/80 ml-1 font-medium">
                  (opcional)
                </span>
              </label>

              <Textarea
                name="observation"
                placeholder="Anotações sobre essa despesa..."
                className="rounded-xl border border-border 
             placeholder:font-sans placeholder:text-base placeholder:text-foreground/80
             !min-h-[120px] !text-base placeholder:font-medium font-semibold
             focus:!ring-2 focus:!ring-primary focus:!outline-none bg-card text-foreground"
              />
            </div>

            {active ? null : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="font-bold font-sans text-lg text-foreground">
                    É uma despesa fixa?
                  </h1>
                  <Checkbox
                    checked={isFixed}
                    onCheckedChange={(checked) => setIsFixed(Boolean(checked))}
                    className="h-[20px] w-[20px] border-border
            data-[state=checked]:bg-primary
            data-[state=checked]:border-primary
            data-[state=checked]:text-foreground"
                  />
                </div>
              </>
            )}

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 mt-3">
              <Button
                type="button"
                onClick={onCloseCard}
                className="bg-secondary text-black hover:bg-secondary border border-border px-7 py-5 font-bold text-base"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                className="bg-primary border border-primary hover:bg-primary/80 text-primary-foreground px-7 py-5 font-bold text-base"
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
