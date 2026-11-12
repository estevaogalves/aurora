import type { TourStep } from "@/components/tour/types";

export const PROJECAO_TOUR: TourStep[] = [
  { target: "periodo", title: "Quantos meses projetar", text: "Use as setas ← e → para diminuir ou aumentar a quantidade de meses da projeção; “Voltar ao padrão” retorna aos 6 meses. Tudo nesta tela acompanha esse período.", placement: ["bottom", "left"] },
  { target: "cenario", title: "Cenário da renda variável", text: "A Projeção só conta renda fixa. Aqui você escolhe como estimar a renda variável dos meses futuros: Conservador (nenhuma, como sempre foi), Médio (média dos últimos 3 meses) ou Otimista (o maior valor dos últimos 3 meses). Só meses futuros recebem estimativa, e a sua escolha fica salva neste navegador.", placement: ["bottom"] },
  { target: "fixa", title: "Despesa fixa mensal", text: "A soma das despesas marcadas como fixas. É o gasto que você já sabe que vai se repetir todo mês.", placement: ["bottom"] },
  { target: "parcelas-total", title: "Parcelas do crédito", text: "Quanto ainda vai cair em parcelas de compras no crédito até o fim do período projetado.", placement: ["bottom"] },
  { target: "pior", title: "Pior mês", text: "O mês com o menor saldo na projeção. Vermelho indica que a conta fecha no negativo.", placement: ["bottom"] },
  { target: "saldo-total", title: "Saldo no período", text: "O que sobra somando todos os meses projetados, considerando renda e despesas fixas, parcelas e despesas extras.", placement: ["bottom", "left"] },
  { target: "renda-despesa", title: "Renda × despesa projetadas", text: "Mês a mês, a renda prevista contra a despesa prevista. Só entram o que é fixo, as parcelas do crédito e as despesas extras. Clique em um mês para ver, num popover, as rendas e despesas dele.", placement: ["top", "bottom"] },
  { target: "acumulado", title: "Saldo acumulado", text: "Como o saldo evolui somando um mês após o outro. Mostra quando a reserva cresce ou quando começa a diminuir.", placement: ["top", "right"] },
  { target: "extras", title: "Despesas extras planejadas", text: "Gastos que não se repetem todo mês, como IPVA ou uma viagem. Cadastre pelo Lançar e edite aqui pelo menu ⋮.", placement: ["top", "right"] },
  { target: "creditos", title: "Parcelas no crédito", text: "Cada compra parcelada em curso, com quantas parcelas faltam e o mês em que termina.", placement: ["top", "left"] },
];
