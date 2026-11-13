import type { TourStep } from "@/components/tour/types";

export const RELATORIOS_TOUR: TourStep[] = [
  { target: "periodo", title: "Escolha os meses", text: "O relatório começa só com o mês atual. Toque nos meses para marcar ou desmarcar quantos quiser (de 1 a 12, não precisam ser seguidos), ou use os atalhos \"Mês atual\", \"Últimos 3 meses\" e \"Últimos 6 meses\". Tudo nesta tela, inclusive a exportação, usa só os meses marcados.", placement: ["bottom"] },
  { target: "renda", title: "Renda no período", text: "O total de renda dos meses escolhidos, com a média mensal.", placement: ["bottom"] },
  { target: "despesas", title: "Despesas no período", text: "O total gasto no mesmo período, também com a média por mês.", placement: ["bottom"] },
  { target: "economia", title: "Economia acumulada", text: "Renda menos despesas no período, e quanto isso representa da renda.", placement: ["bottom"] },
  { target: "categoria", title: "Maior categoria", text: "A categoria em que você mais gastou no período e o valor total.", placement: ["bottom", "left"] },
  { target: "resumo", title: "Resumo mês a mês", text: "Renda, despesas e saldo de cada mês. É a base do que vai para o relatório.", placement: ["right", "top"] },
  { target: "exportar", title: "Exportar relatório", text: "Escolha o formato (PDF, CSV ou TXT) e o que incluir, e baixe o arquivo do período escolhido. Para não precisar marcar tudo toda vez, deixe do jeito que quer e clique em \"Salvar alterações\": a tela passa a abrir assim, com o formato e o conteúdo que você salvou.", placement: ["left", "top"] },
  { target: "fechados", title: "Meses fechados", text: "Cada mês que você fecha no Painel (botão Fechar mês) deixa aqui um retrato: renda, despesas, saldo e a anotação que você escreveu. O retrato não muda se os lançamentos mudarem depois. Com mais de 3 meses fechados aparecem o filtro por ano e a escolha de 3 ou 6 meses por página, e a lista passa a ter páginas. Reabrir o mês no Painel remove o retrato.", placement: ["top", "right"] },
];
