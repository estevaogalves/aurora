import { Card, CardContent } from "../../components/ui/card";

interface AddExtraExpensesProps {
 onCloseCard: () => void
}



export default function AddExtraExpenses({onCloseCard}: AddExtraExpensesProps) {
  return (
    <div>
       <Card className="border border-dashed rounded-xl bg-slate-900 border-slate-600">
         <CardContent>
            <form>
                <div className="grid grid-cols-3 gap-3">
                    <section className="flex flex-col mt-4">
                        <label className="text-slate-300 font-bold">Mês</label>
                        <input 
                        placeholder="Selecione o mês"
                        className="rounded-lg bg-slate-800 px-3 py-2 placeholder:text-slate-400 placeholder:font-bold mt-2" />
                    </section>
                    <section className="flex flex-col mt-4">
                        <label className="text-slate-300 font-bold">Valor</label>
                        <input 
                        placeholder="0,00"
                        className="rounded-lg bg-slate-800 px-3 py-2 placeholder:text-slate-400 placeholder:font-bold mt-2" />
                    </section>
                    <section className="flex flex-col mt-4">
                        <label className="text-slate-300 font-bold">Descrição</label>
                        <input 
                        placeholder="EX: Viagem, IPVA..."
                        className="rounded-lg bg-slate-800 px-3 py-2 placeholder:text-slate-400 placeholder:font-bold mt-2" />
                    </section>
                </div>
                <div className="flex flex-row gap-3 justify-end mt-5">
                    <button 
                    onClick={onCloseCard}
                    className="text-lg font-medium rounded-lg px-6 py-1.5 text-white bg-transparent hover:bg-slate-800/70">Cancelar</button>
                    <button 
                    className="text-lg font-medium rounded-lg px-6 py-1.5 text-white bg-green-800 hover:bg-green-900">Adicionar</button>
                </div>
            </form>
         </CardContent>
       </Card>
    </div>
  )
}