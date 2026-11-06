import { useState } from "react";
import { BiInfoCircle } from "react-icons/bi";
import { IoMdAdd } from "react-icons/io";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import AddExtraExpenses from "./AddExtraExpenses";

export default function ExtraExpenses() {

  const [showCard, setShowCard] = useState(false);

  const openCard = () => {
    setShowCard(true)
  }

  const closeCard = () => {
    setShowCard(false)
  }

  return (
    <div className="mt-6 w-[1440px] mx-44">
      <Card className="rounded-xl bg-slate-900 border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <section>
              <CardTitle className="text-lg text-slate-300 font-bold">
                Despesas extras planejadas
              </CardTitle>
              <CardDescription className="text-base text-slate-400 font-medium">
                Adicione gastos previstos para ajustar a projecao
              </CardDescription>
            </section>
            <section>
              <button
                onClick={openCard}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800/50 text-white font-bold px-6 py-2 text-lg"
              >
                <IoMdAdd className="w-5 h-5" />
                Adicionar
              </button>
            </section>
          </div>
        </CardHeader>
        <CardContent>
          {showCard && <AddExtraExpenses onCloseCard={closeCard}/>}
          {/* Aqui vai ficar o map com a renderizaçao das despesas extras */}
          <div className="flex items-center gap-2 text-slate-600 mt-5">
            <BiInfoCircle className="text-xl mb-1" />
            <span className="text-lg font-medium">
              Nenhuma despesa extra planejada
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
