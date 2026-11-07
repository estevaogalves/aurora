import type { TourStep } from "@/components/tour/types";

export const COMPARACAO_TOUR: TourStep[] = [
  { target: "meses", title: "Escolha os meses", text: "Marque até 5 meses com movimentação para comparar. Atingido o limite, desmarque um para escolher outro.", placement: ["bottom"] },
  { target: "saldo-medio", title: "Saldo médio", text: "A média do saldo dos meses selecionados.", placement: ["bottom"] },
  { target: "melhor", title: "Melhor mês", text: "O mês de maior saldo entre os escolhidos.", placement: ["bottom"] },
  { target: "pior", title: "Pior mês", text: "O mês de menor saldo entre os escolhidos.", placement: ["bottom"] },
  { target: "ranking", title: "Ranking de saldo", text: "Os meses do melhor ao pior saldo, com uma barra para enxergar a distância entre eles.", placement: ["right", "bottom"] },
  { target: "renda-despesa", title: "Renda e despesa", text: "Renda e despesa de cada mês lado a lado, para ver em qual deles o gasto pesou mais.", placement: ["left", "bottom"] },
  { target: "perfil", title: "Perfil de gastos", text: "O formato do gasto de cada mês por categoria. Meses com formas parecidas gastaram de modo parecido.", placement: ["top", "right"] },
  { target: "categorias", title: "Categorias lado a lado", text: "O valor gasto em cada categoria, mês a mês. Mostra em que categoria a diferença apareceu.", placement: ["top", "left"] },
];
