import type { TourStep } from "@/components/tour/types";

export const INVESTIMENTOS_TOUR: TourStep[] = [
  { target: "novo", title: "Novo investimento", text: "Cadastra um CDB, um fundo, ações ou o que você tiver. É um controle manual: o Aurora não se liga a bancos nem a corretoras, então os valores são os que você informar.", placement: ["bottom", "left"] },
  { target: "patrimonio", title: "Patrimônio investido", text: "Quanto vale hoje tudo o que você tem investido, somando o valor atual de cada investimento.", placement: ["bottom"] },
  { target: "aportado", title: "Total aportado", text: "A soma dos aportes que você registrou. O que já foi resgatado aparece à parte, na legenda.", placement: ["bottom"] },
  { target: "lucro", title: "Lucro ou prejuízo", text: "Valor atual mais o que você já resgatou, menos o que aportou. Aporte novo não conta como lucro e resgate não conta como perda.", placement: ["bottom"] },
  { target: "rentabilidade", title: "Rentabilidade", text: "O lucro dividido pelo total aportado. É calculada pelo Aurora, você não digita.", placement: ["bottom", "left"] },
  { target: "vazio", title: "Comece pelo primeiro investimento", text: "Ainda não há investimentos. Use Novo investimento para registrar o primeiro e acompanhe o patrimônio aqui.", placement: ["top", "bottom"] },
  { target: "por-tipo", title: "Por tipo", text: "Como o patrimônio se divide entre renda fixa, Tesouro, liquidez diária, ações e fundos.", placement: ["right", "bottom"] },
  { target: "por-instituicao", title: "Por instituição", text: "Em qual banco ou corretora está o seu dinheiro, para você ver se está concentrado em um lugar só.", placement: ["left", "bottom"] },
  { target: "vencimentos", title: "Próximos vencimentos", text: "O que vence nos próximos 90 dias, com o valor de cada um, incluindo o que já venceu e ainda não foi resgatado. O sino do topo avisa 30 dias antes e até você registrar o resgate.", placement: ["top", "bottom"] },
  { target: "investimento", title: "Cartão do investimento", text: "Mostra o valor atual, o lucro, quanto foi aportado e resgatado, a taxa, o vencimento, a liquidez e as cotas com o preço médio, quando o investimento controla quantidade.", placement: ["right", "bottom"] },
  { target: "investimento-acoes", title: "Movimentar, histórico, editar e excluir", text: "Movimentar registra um aporte, um resgate, um rendimento ou uma atualização de valor, e o valor atual é refeito pela ordem das datas. O Histórico permite corrigir ou excluir cada movimentação.", placement: ["top", "bottom"] },
];
