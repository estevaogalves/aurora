import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface AddGoalsProps {
  onCloseCard: () => void;
}

export default function AddGoals({ onCloseCard }: AddGoalsProps) {
  return (
    <div className="flex items-center justify-center fixed inset-0 backdrop-blur-sm bg-black/90 z-50">
      <Card className="w-full max-w-[500px] rounded-xl bg-card border-border">
        <CardHeader>
          <CardTitle className="font-bold text-2xl flex items-center justify-between mb-4">
            <h1 className="text-foreground">Nova Meta Financeira</h1>
            <button onClick={onCloseCard} className="text-base text-muted-foreground mr-1">X</button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col">
              <label className="font-bold font-sans text-lg text-foreground">Nome da meta</label>
              <input
                type="text"
                name=""
                placeholder="Ex: Viagem, Fundo de emergencia, Carro novo..."
                className="border px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary font-semibold bg-card text-foreground mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <section>
                <label className="font-bold font-sans text-lg text-foreground">Valor da meta (R$)</label>
                <input
                  type="text"
                  name=""
                  placeholder="10.000,00"
                  className="border w-full px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary font-semibold bg-card text-foreground mt-1"
                />
              </section>
              <section>
                <label className="font-bold font-sans text-lg text-foreground">Já guardou (R$)</label>
                <input
                  type="text"
                  name=""
                  placeholder="0,00"
                  className="border w-full px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary font-semibold bg-card text-foreground mt-1"
                />
              </section>
            </div>
            <div className="mt-6 flex flex-col">
              <label className="font-bold font-sans text-lg text-foreground">Prazo</label>
              <input
                type="date"
                name=""
                className="border px-3 py-2.5 rounded-xl placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary font-semibold bg-card text-foreground mt-1"
              />
            </div>
            <button className="bg-primary border border-primary hover:bg-primary/80 text-primary-foreground px-4 py-3 mt-5 rounded-xl font-bold text-base w-full">
                Criar Meta
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
