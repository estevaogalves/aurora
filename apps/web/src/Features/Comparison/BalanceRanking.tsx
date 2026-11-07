import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

type Items = {
  income: number;
  expense: number;
  id: number;
  month: string;
  balance: number;
};

export default function BalanceRanking() {
  const items: Items[] = [
    {
      id: 1,
      month: "Março de 2026",
      income: 2500.0,
      expense: 1400.0,
      balance: 900.0,
    },
    {
      id: 2,
      month: "Abril de 2026",
      income: 2500.0,
      expense: 1400.0,
      balance: 1000.0,
    },
    {
      id: 3,
      month: "Maio de 2026",
      income: 2500.0,
      expense: 1400.0,
      balance: 1200.0,
    },
    {
      id: 4,
      month: "Junho de 2026",
      income: 2500.0,
      expense: 1400.0,
      balance: 800.0,
    },
  ];

  const sorted = [...items].sort((a, b) => b.balance - a.balance);

  return (
    <div className="mx-44">
      <Card className="rounded-xl bg-card border-border w-[1380px] mt-6 mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-foreground/80 font-bold">
            Ranking de Saldo
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground font-medium">
            Do melhor para o pior mês
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sorted.map((item, index) => {
            const isBest = index === 0;
            const isWorst = index === sorted.length - 1;

            return (
              <div
                key={item.id}
                className={`
                  mt-3 flex items-center justify-between p-3 rounded-xl border transition-all
                  ${isBest ? "border-primary" : ""}
                  ${isWorst ? "border-destructive" : ""}
                  ${!isBest && !isWorst ? "border-border" : ""}
                `}
              >
                {/* LEFT SIDE */}
                <section className="flex items-center gap-3">
                  <span
                    className={`
                      text-2xl rounded-full w-16 h-16 flex items-center justify-center font-bold border
                      ${isBest ? "border-primary text-success" : ""}
                      ${isWorst ? "border-destructive text-destructive" : ""}
                      ${!isBest && !isWorst ? "border-border text-foreground" : ""}
                    `}
                  >
                    {index + 1}
                  </span>

                  <section>
                    <h1 className="text-foreground text-xl font-bold">
                      {item.month}
                    </h1>

                    <div className="flex gap-3">
                      <span className="text-foreground/80">
                        <strong>Renda:</strong> R$ {item.income}
                      </span>

                      <span className="text-foreground/80">
                        <strong>Despesas:</strong> R$ {item.expense}
                      </span>
                    </div>
                  </section>
                </section>

                {/* RIGHT SIDE */}
                <section>
                  <h1 className="text-2xl text-muted-foreground font-semibold mr-4">
                    R$: {item.balance}
                  </h1>
                </section>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}