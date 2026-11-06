import CardEmpty from "./CardEmpty"
import CardPositive from "./CardPositive"
import CardNegative from "./CardNegative"
import { useFinanceStore } from "@/Store/FinanceStore"

export default function MoneyCard() {

    useFinanceStore((state) => state.transactions);

    const { balance } = useFinanceStore
    .getState()
    .getTotals();

    // card neutro
    if(balance === undefined || balance === 0) {
        return <CardEmpty/>
    }

    if(balance > 0){
        return (
            <CardPositive/>
        )
    }

    return <CardNegative/>
}
