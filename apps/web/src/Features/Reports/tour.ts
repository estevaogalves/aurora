import type { TourStep } from "@/components/tour/types";

export const RELATORIOS_TOUR: TourStep[] = [
  { target: "periodo", title: "Escolha o período", text: "Defina o mês de início e o de fim (de 1 a 6 meses). Tudo nesta tela, inclusive a exportação, usa esse período. Sem escolher, vale os 6 meses que terminam no mês do seletor do topo.", placement: ["bottom"] },
  { target: "renda", title: "Renda no período", text: "O total de renda dos meses escolhidos, com a média mensal.", placement: ["bottom"] },
  { target: "despesas", title: "Despesas no período", text: "O total gasto no mesmo período, também com a média por mês.", placement: ["bottom"] },
  { target: "economia", title: "Economia acumulada", text: "Renda menos despesas no período, e quanto isso representa da renda.", placement: ["bottom"] },
  { target: "categoria", title: "Maior categoria", text: "A categoria em que você mais gastou no período e o valor total.", placement: ["bottom", "left"] },
  { target: "resumo", title: "Resumo mês a mês", text: "Renda, despesas e saldo de cada mês. É a base do que vai para o relatório.", placement: ["right", "top"] },
  { target: "exportar", title: "Exportar relatório", text: "Escolha o formato (PDF, CSV ou TXT) e o que incluir, e baixe o arquivo do período escolhido.", placement: ["left", "top"] },
];
