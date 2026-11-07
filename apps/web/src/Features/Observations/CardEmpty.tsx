// arquivo que calcula o que fazer com o restante do dinheiro - arquivo que mostra quando nao tem nada
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { FaRegLightbulb } from "react-icons/fa";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";

export default function CardEmpty() {
  return (
    <div>
      <Card className="bg-card border-border ">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="text-2xl border px-1.5 py-1.5 rounded-lg bg-primary/10 text-primary border-primary">
              <FaRegLightbulb />
            </div>

            <section>
              <CardTitle className="text-xl font-sans font-bold text-foreground">
                Dicas para o seu dinheiro
              </CardTitle>
              <CardDescription className="text-md font-sans font-medium text-foreground/80">
                Preencha suas rendas e despesas
              </CardDescription>
            </section>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 mt-1 rounded-lg bg-primary/10 text-primary border border-primary p-1">
              <IoMdCheckmarkCircleOutline className="text-success" />
            </span>
            <p className="mt-1.5 text-base text-foreground/80 font-medium">
              Comece adicionando suas fontes de renda e depois cadastre as
              despesas do mes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
