import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function DashboardComparison() {
  const items = [
    { id: 1, month: "Mar/26", expense: 1200 },
    { id: 2, month: "Fev/26", expense: 1000 },
    { id: 3, month: "Abr/26", expense: 1500 },
    { id: 4, month: "Mai/26", expense: 900 },
    { id: 5, month: "Jun/26", expense: 800 },
    { id: 6, month: "Jul/26", expense: 980 },
  ];

  const meses = [
    { id: 1, month: "Março de 2026" },
    { id: 2, month: "Fevereiro de 2026" },
    { id: 3, month: "Abril de 2026" },
    { id: 4, month: "Maiio de 2026" },
    { id: 5, month: "Junho de 2026" },
    { id: 6, month: "Julho de 2026" },
  ];

  const [openCard, setOpenCard] = useState(false);

  return (
    <div className="mt-6 mx-44">
      <div className="flex items-center justify-between">
        <section>
          <h1 className="text-3xl font-bold text-foreground">Comparação de Meses</h1>
          <p className="text-xl font-medium text-foreground/80">
            Selecione ate 6 meses para comparar seus gastos
          </p>
        </section>
      </div>
      <Card className="rounded-xl bg-card border-border w-[1380px] mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <section>
              <CardTitle className="text-xl font-bold text-foreground/80">
                Selecione os meses
              </CardTitle>
              <CardDescription className="font-medium text-muted-foreground text-base mt-1">
                0/6 meses selecionados
              </CardDescription>
            </section>
            <section>
              <button
                onClick={() => setOpenCard((prev) => !prev)}
                className="text-foreground/80 font-bold rounded-lg px-3 py-2 bg-secondary hover:bg-secondary"
              >
                {openCard ? "Ocultar meses" : "Mostrar meses"}
              </button>
            </section>
          </div>
        </CardHeader>
        {openCard && (
          <>
            <CardContent>
              <div className="grid grid-cols-7 gap-3">
                {items.map((item) => {
                  return (
                    <button
                      key={item.id}
                      className="px-12 py-4 font-bold text-foreground/80 bg-secondary border-border hover:border-border border text-lg rounded-xl flex flex-col"
                    >
                      {item.month}
                      <span className="text-base text-muted-foreground">
                        R$ {item.expense}
                      </span>
                    </button>
                  );
                })}
              </div>
              <hr className="mt-6 border-border" />
              <div className="flex flex-grow gap-2">
                {meses.map((mes) => {
                  return (
                    <div
                      key={mes.id}
                      className="border-border border rounded-3xl px-4 py-1.5 w-[230px] flex justify-between mt-6"
                    >
                      <section className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-secondary rounded-xl" />
                        <h1 className="text-foreground font-bold text-base">
                          {mes.month}
                        </h1>
                      </section>
                      <button className="text-foreground/80">x</button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Cards de comparação - so mostrar se tiver pelo menos 2 meses selecionados */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="rounded-xl bg-card border-border mt-6 pt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-muted-foreground">
              Média de renda
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              R$ 0,00
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="rounded-xl bg-card border-border mt-6 pt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-muted-foreground">
              Média de despesas
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              R$ 0,00
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="rounded-xl bg-primary/20 border-primary mt-6 pt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-muted-foreground">
              Melhor mês
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              <div className="flex flex-col">
                <h1 className="text-primary">Mar/26</h1>
                <span className="text-sm mt-0.5 font-semibold text-muted-foreground">
                  Saldo: R$0,00
                </span>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="rounded-xl bg-destructive/20 border-destructive mt-6 pt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-muted-foreground">
              Pior mês
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              <div className="flex flex-col">
                <h1 className="text-destructive">Fev/26</h1>
                <span className="text-sm mt-0.5 font-semibold text-muted-foreground">
                  Saldo: R$0,00
                </span>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* se nao for selecionado dois meses pelo menos - mostra esse card */}
      {/* <Card className="rounded-xl bg-card border-border w-[1380px] mt-6">
        <CardHeader className="py-36">
          <div className="flex flex-col items-center">
            <div className="text-foreground/80">
              <GoArrowSwitch size={58} />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground/80 mt-6">
              Selecione pelo menos 2 meses para comparar
            </CardTitle>
            <CardDescription className="font-medium text-muted-foreground text-xl mt-1">
              Clique em "Mostrar meses" acima para selecionar
            </CardDescription>
          </div>
        </CardHeader>
      </Card> */}
    </div>
  );
}
