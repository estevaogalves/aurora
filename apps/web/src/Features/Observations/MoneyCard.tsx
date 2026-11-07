import CardEmpty from "./CardEmpty"
import CardPositive from "./CardPositive"
import CardNegative from "./CardNegative"
import { useMonthSummary } from "@/Store/selectors"

export default function MoneyCard() {

    const { balance } = useMonthSummary();

    // card neutro
    if(balance === 0) {
        return <CardEmpty/>
    }

    if(balance > 0){
        return (
            <CardPositive/>
        )
    }

    return <CardNegative/>
}
