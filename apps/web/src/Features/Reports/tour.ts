import type { TourStep } from "@/components/tour/types";

export const RELATORIOS_TOUR: TourStep[] = [
  { target: "renda", title: "Renda em 6 meses", text: "O total de renda dos últimos 6 meses, com a média mensal.", placement: ["bottom"] },
  { target: "despesas", title: "Despesas em 6 meses", text: "O total gasto no mesmo período, também com a média por mês.", placement: ["bottom"] },
  { target: "economia", title: "Economia acumulada", text: "Renda menos despesas no período, e quanto isso representa da renda.", placement: ["bottom"] },
  { target: "categoria", title: "Maior categoria", text: "A categoria em que você mais gastou nesses 6 meses e o valor total.", placement: ["bottom", "left"] },
  { target: "resumo", title: "Resumo mês a mês", text: "Renda, despesas e saldo de cada mês. É a base do que vai para o relatório.", placement: ["right", "top"] },
  { target: "exportar", title: "Exportar relatório", text: "Escolha o período, o formato (PDF, CSV ou TXT) e o que incluir, e baixe o arquivo.", placement: ["left", "top"] },
];
