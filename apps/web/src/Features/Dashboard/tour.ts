import type { TourStep } from "@/components/tour/types";

export const PAINEL_TOUR: TourStep[] = [
  { target: "lancar", title: "Todo cadastro começa aqui", text: "O botão Lançar abre o formulário de despesa, renda, compra no crédito, despesa extra e meta. O Painel só mostra os números.", placement: ["bottom", "left"] },
  { target: "mes", title: "Troque o mês", text: "Use as setas para navegar entre os meses. Meses futuros estão sempre liberados e mostram o que já está previsto (fixas, parcelas e despesas extras). Meses passados só aparecem se tiveram movimentação.", placement: ["bottom", "left"] },
  { target: "prazos", title: "Metas com prazo chegando", text: "Este aviso aparece quando uma meta está perto do prazo ou vencida. Marque como visto para dispensá-lo; ele também fica no sino do topo.", placement: ["bottom"] },
  { target: "saldo", title: "Seu saldo do mês", text: "Renda menos despesas, já somando as parcelas do crédito. A barra mostra quanto da renda está comprometida.", placement: ["right", "bottom"] },
  { target: "tendencia", title: "Últimos 6 meses", text: "Renda e despesas mês a mês, para ver se o gasto está subindo ou se a renda cobre o que sai.", placement: ["left", "bottom"] },
  { target: "categorias", title: "Despesas por categoria", text: "Para onde foi o dinheiro neste mês. Passe o mouse sobre uma fatia para ver o valor e clique (ou toque) para ver os lançamentos dela.", placement: ["top", "right"] },
  { target: "sugestao", title: "Como dividir o que sobrou", text: "Uma sugestão de como repartir o saldo do mês. O botão Enviar manda a fatia para um porquinho, uma meta ou um investimento: o valor entra no histórico do destino, o saldo daqui continua o mesmo e a fatia mostra o que já foi enviado. Uma renda marcada como \"Distribuir separado\" (13º, bônus) ganha a sua própria sugestão, sem se misturar com o saldo do mês. No menu ⋮ você personaliza os percentuais e cria suas próprias fatias.", placement: ["top", "right"] },
  { target: "metas", title: "Progresso das metas", text: "Um resumo dos seus objetivos. Os detalhes e os aportes ficam na aba Metas.", placement: ["top", "left"] },
  { target: "despesas", title: "Despesas do mês", text: "As 5 despesas mais recentes. A lista completa, com edição, fica em Lançamentos.", placement: ["top", "right"] },
  { target: "anotacoes", title: "Anotações do mês", text: "Seus lembretes do mês, só para leitura aqui. Para criar ou editar, use a aba Lançamentos.", placement: ["top", "left"] },
];
