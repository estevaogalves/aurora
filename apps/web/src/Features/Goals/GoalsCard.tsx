import { useState } from "react";
import { FiTarget } from "react-icons/fi";
import { IoMdAdd } from "react-icons/io";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import AddGoals from "./AddGoals";

export default function GoalsCard() {

  const [showCard, setShowCard] = useState(false)

  const openCard = () => {
    setShowCard(true)
  }

  const closeCard = () => {
    setShowCard(false)
  }



  return (
    <div>
      {/* titulo */}
      <div className="mx-44 mt-6">
        <h1 className="text-3xl font-bold text-foreground">Metas Financeiras</h1>
        <p className="text-xl font-medium text-foreground/80">
          Acompanhe o progresso das suas metas e objetivos
        </p>
      </div>

      <Card className="rounded-xl bg-card border-border w-[1440px] mt-6 mx-44">
        <CardHeader className="flex flex-row items-center justify-between">
          {/* ESQUERDA */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-800 p-2 text-purple-200">
              <FiTarget className="w-6 h-6" />
            </div>

            <section>
              <CardTitle className="text-xl font-bold text-foreground">
                Metas Financeiras
              </CardTitle>
              <CardDescription className="text-base font-medium text-foreground/80">
                Cadastre seus objetivos
              </CardDescription>
            </section>
          </div>

          {/* DIREITA */}
          <button 
          onClick={openCard}
          className="flex items-center gap-2 p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2 text-lg">
            <IoMdAdd className="w-5 h-5" />
            Nova Meta
          </button>
        </CardHeader>
        <CardContent className="mt-12 mb-6">
          <div className="flex flex-col items-center text-foreground gap-1">
            <div className="rounded-3xl bg-secondary p-2 text-foreground">
              <FiTarget className="text-3xl" />
            </div>
            <h1 className="text-lg font-medium text-foreground/80 ">Nenhuma meta cadastrada ainda.</h1>
            <p className="text-base font-medium text-foreground/80">Crie metas com prazos para acompanhar seu progresso.</p>
          </div>
        </CardContent>
      </Card>

      {showCard && <AddGoals onCloseCard={closeCard}/>}
    </div>
  );
}
