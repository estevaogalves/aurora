import { Card, CardContent } from "../../components/ui/card";

interface AddExtraExpensesProps {
 onCloseCard: () => void
}



export default function AddExtraExpenses({onCloseCard}: AddExtraExpensesProps) {
  return (
    <div>
       <Card className="border border-dashed rounded-xl bg-card border-border">
         <CardContent>
            <form>
                <div className="grid grid-cols-3 gap-3">
                    <section className="flex flex-col mt-4">
                        <label className="text-foreground/80 font-bold">Mês</label>
                        <input 
                        placeholder="Selecione o mês"
                        className="rounded-lg bg-secondary px-3 py-2 placeholder:text-muted-foreground placeholder:font-bold mt-2" />
                    </section>
                    <section className="flex flex-col mt-4">
                        <label className="text-foreground/80 font-bold">Valor</label>
                        <input 
                        placeholder="0,00"
                        className="rounded-lg bg-secondary px-3 py-2 placeholder:text-muted-foreground placeholder:font-bold mt-2" />
                    </section>
                    <section className="flex flex-col mt-4">
                        <label className="text-foreground/80 font-bold">Descrição</label>
                        <input 
                        placeholder="EX: Viagem, IPVA..."
                        className="rounded-lg bg-secondary px-3 py-2 placeholder:text-muted-foreground placeholder:font-bold mt-2" />
                    </section>
                </div>
                <div className="flex flex-row gap-3 justify-end mt-5">
                    <button 
                    onClick={onCloseCard}
                    className="text-lg font-medium rounded-lg px-6 py-1.5 text-foreground bg-transparent hover:bg-secondary">Cancelar</button>
                    <button 
                    className="text-lg font-medium rounded-lg px-6 py-1.5 text-primary-foreground bg-primary hover:bg-primary/80">Adicionar</button>
                </div>
            </form>
         </CardContent>
       </Card>
    </div>
  )
}