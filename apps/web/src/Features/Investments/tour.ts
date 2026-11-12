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
  { target: "negocios", title: "Meus negócios", text: "Para acompanhar um negócio seu (revenda, por exemplo), escolha “Negócio próprio” ao criar o investimento. Aqui ficam o que você investiu (pode ser em várias vezes), o que recebeu das vendas, o que já sacou e o lucro (recebido − investido). Enquanto o recebido for menor que o investido, aparece “Em prejuízo” e quanto falta recuperar. O negócio não entra no patrimônio nem nos gráficos de mercado.", placement: ["top", "right"] },
];

export const SIMULADOR_TOUR: TourStep[] = [
  { target: "sim-aviso", title: "Uma simulação, não uma promessa", text: "O simulador só faz a conta com os números que você digitar. Ele não consulta bancos, não sugere taxas e não é recomendação de investimento.", placement: ["bottom"] },
  { target: "sim-campos", title: "Seus números", text: "Aporte mensal (já vem com a média dos seus aportes registrados, se houver), valor inicial, prazo em anos e a rentabilidade anual que você quiser testar. Nada é calculado enquanto faltar o aporte (ou o valor inicial) e a rentabilidade.", placement: ["bottom"] },
  { target: "sim-exemplos", title: "Exemplos de taxa", text: "Os botões só preenchem o campo com uma taxa de exemplo para você ver o simulador funcionando. Troque por qualquer valor: eles não são promessa nem previsão.", placement: ["bottom", "top"] },
  { target: "sim-resultado", title: "O resultado", text: "Total investido (seus aportes), rendimento estimado (juros compostos, com o aporte no fim de cada mês) e o valor final.", placement: ["bottom"] },
  { target: "sim-grafico", title: "Evolução ano a ano", text: "A linha do valor estimado se afasta da linha do que você investiu: essa distância é o rendimento. Passe o mouse (ou toque) para ver os valores de cada ano.", placement: ["top", "right"] },
  { target: "sim-dividendos", title: "Renda passiva por dividendos", text: "Informe o yield anual que você espera e veja quanto o valor final renderia por mês. Se você também informar os proventos mensais que recebe, o simulador calcula o yield on cost.", placement: ["top", "right"] },
  { target: "sim-carteira", title: "Carteira de dividendos", text: "Cadastre à mão os ativos que pagam dividendos: quanto você investiu e quanto recebe de proventos por mês. O Aurora calcula o yield on cost (proventos do mês × 12 ÷ valor investido) de cada ativo e da carteira. É só um acompanhamento: não entra em saldo, patrimônio nem projeção.", placement: ["top", "right"] },
];
