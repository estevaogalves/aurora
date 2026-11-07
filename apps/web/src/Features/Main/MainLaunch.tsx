import Expenses from "../Expenses/Expenses";
import Incomes from "../Income/Incomes";
import Notes from "../Observations/Notes";

export default function MainLaunch() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground">Lançamentos</h1>
        <p className="text-muted-foreground">Rendas, despesas e parcelas do mês. Use o botão Lançar para adicionar.</p>
      </header>
      <Incomes />
      <Expenses />
      <Notes />
    </div>
  );
}
